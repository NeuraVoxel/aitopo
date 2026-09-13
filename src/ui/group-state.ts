/**
 * Group expand/collapse and band geometry helpers shared by views.
 */

import { growRect, unionRect, type Point, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphGroup, GraphNode } from '../protocol/types.ts'
import { groupBounds, nodeBounds } from './bounds.ts'

/** Default padding around member union when auto-fitting (world px). */
export const DEFAULT_GROUP_PADDING = 16

/**
 * Paint-extent bounds per member node (body ∪ attachments). Scene-only
 * callers omit it and unions fall back to bare bodies.
 * @param node - member node.
 */
export type MemberBoundsResolver = (node: GraphNode) => Rect

/**
 * Whether a group paints as an expanded band.
 * Omitted `expanded` is collapsed (`false`).
 * @param group - graph element.
 */
export function isGroupExpanded(group: GraphGroup): boolean {
  return group.expanded === true
}

/**
 * Resolve the group that owns a node (`groupId` or `memberIds`).
 * @param scene - live scene.
 * @param nodeId - node id.
 */
export function findGroupForNode(scene: GraphScene, nodeId: string): GraphGroup | undefined {
  const node = scene.nodes.get(nodeId)
  if (node?.groupId !== undefined) {
    const byId = scene.groups.get(node.groupId)
    if (byId !== undefined) return byId
  }
  for (const group of scene.groups.values()) {
    if (group.memberIds.includes(nodeId)) return group
  }
  return undefined
}

/**
 * Collapsed group containing the node, if any.
 * @param scene - live scene.
 * @param nodeId - node id.
 */
export function collapsedGroupForNode(
  scene: GraphScene,
  nodeId: string,
): GraphGroup | undefined {
  const group = findGroupForNode(scene, nodeId)
  if (group === undefined || isGroupExpanded(group)) return undefined
  return group
}

/**
 * Whether the node should be painted and hit-tested.
 * @param scene - live scene.
 * @param nodeId - node id.
 */
export function isNodeVisibleInScene(scene: GraphScene, nodeId: string): boolean {
  return collapsedGroupForNode(scene, nodeId) === undefined
}

/**
 * Member nodes of a group (`memberIds` ∪ `groupId` matches).
 * @param scene - live scene.
 * @param group - group element.
 */
export function listGroupMembers(scene: GraphScene, group: GraphGroup): GraphNode[] {
  const seen = new Set<string>()
  const out: GraphNode[] = []
  for (const id of group.memberIds) {
    const node = scene.nodes.get(id)
    if (node === undefined || seen.has(id)) continue
    seen.add(id)
    out.push(node)
  }
  for (const node of scene.nodes.values()) {
    if (node.groupId !== group.id || seen.has(node.id)) continue
    seen.add(node.id)
    out.push(node)
  }
  return out
}

/**
 * Center of an AABB.
 * @param rect - world rect.
 */
export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/**
 * Member union (no padding), or undefined when empty. With a resolver the
 * union covers member paint extents (attachments included); without it,
 * bare bodies.
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver.
 */
export function memberUnionBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf: MemberBoundsResolver = nodeBounds,
): Rect | undefined {
  let union: Rect | undefined
  for (const node of listGroupMembers(scene, group)) {
    union = unionRect(union, memberBoundsOf(node))
  }
  return union
}

/**
 * Expanded auto-fit band from current member positions (ignores `expanded` flag).
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver.
 */
export function computeExpandedBandBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf?: MemberBoundsResolver,
): Rect {
  const union = memberUnionBounds(scene, group, memberBoundsOf)
  if (union === undefined) return groupBounds(group)
  const padding = group.style?.padding ?? DEFAULT_GROUP_PADDING
  return growRect(union, padding)
}

/**
 * Band body rectangle: document geometry when collapsed or `autoFit: false`;
 * otherwise member union + padding (fallback to document when empty).
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver.
 */
export function computeGroupBandBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf?: MemberBoundsResolver,
): Rect {
  const autoFit = group.style?.autoFit !== false
  if (!isGroupExpanded(group) || !autoFit) {
    return groupBounds(group)
  }
  return computeExpandedBandBounds(scene, group, memberBoundsOf)
}

/**
 * Top-left for a collapsed body centered on `center`.
 * @param group - group (reads `w`/`h` defaults).
 * @param center - world center.
 */
export function collapsedOriginForCenter(group: GraphGroup, center: Point): Point {
  const body = groupBounds({ ...group, x: 0, y: 0 })
  return {
    x: center.x - body.width / 2,
    y: center.y - body.height / 2,
  }
}

/**
 * Geometry patches when toggling expand/collapse so the shared center is preserved:
 * - collapse: place the node body at the expanded band center
 * - expand: translate members so the auto-fit band centers on the collapsed body center
 * @param scene - live scene.
 * @param group - group before toggle.
 * @param nextExpanded - target expanded flag.
 * @param memberBoundsOf - optional paint-extent resolver (must match the painted band).
 */
export function expandCollapseCenterPatches(
  scene: GraphScene,
  group: GraphGroup,
  nextExpanded: boolean,
  memberBoundsOf?: MemberBoundsResolver,
): {
  readonly groupPatch: { expanded: boolean; x?: number; y?: number }
  readonly memberMoves: readonly {
    id: string
    from: Point
    to: Point
  }[]
} {
  if (!nextExpanded) {
    const band = computeExpandedBandBounds(scene, group, memberBoundsOf)
    const origin = collapsedOriginForCenter(group, rectCenter(band))
    return {
      groupPatch: { expanded: false, x: origin.x, y: origin.y },
      memberMoves: [],
    }
  }

  const center = rectCenter(groupBounds(group))
  const band = computeExpandedBandBounds(scene, group, memberBoundsOf)
  const current = rectCenter(band)
  const dx = center.x - current.x
  const dy = center.y - current.y
  const memberMoves = listGroupMembers(scene, group).map(node => {
    const from = { x: node.x ?? 0, y: node.y ?? 0 }
    return {
      id: node.id,
      from,
      to: { x: from.x + dx, y: from.y + dy },
    }
  })
  return {
    groupPatch: {
      expanded: true,
      ...(group.x !== undefined ? { x: group.x } : { x: groupBounds(group).x }),
      ...(group.y !== undefined ? { y: group.y } : { y: groupBounds(group).y }),
    },
    memberMoves,
  }
}

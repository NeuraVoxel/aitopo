/**
 * Group expand/collapse and band geometry helpers shared by views.
 * Supports nested groups via `parentId` + child ids in `memberIds`.
 */

import { growRect, growRectInsets, unionRect, type Point, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphGroup, GraphNode, GraphShapeNode } from '../protocol/types.ts'
import { groupBounds, nodeBounds, unionPoint } from './bounds.ts'

/** Default padding on left / right / bottom when auto-fitting (world px). */
export const DEFAULT_GROUP_PADDING = 16
/** Inside-top title inset used when sizing default top clearance. */
const GROUP_TITLE_INSET = 8
/** Gap between group title block and member content. */
const GROUP_TITLE_MEMBER_GAP = 8
/** Scene-only pad around shape-node control-point AABB when no View bounds. */
const SHAPE_NODE_FALLBACK_PAD = 4

/**
 * Paint-extent bounds per member node (body ∪ attachments). Scene-only
 * callers omit it and unions fall back to bare bodies.
 * @param node - member node.
 */
export type MemberBoundsResolver = (node: GraphNode) => Rect

/**
 * Paint-extent bounds per member shape node. Scene-only callers omit it and
 * unions fall back to control-point AABB (+ pad).
 * @param shapeNode - member shape node.
 */
export type ShapeNodeBoundsResolver = (shapeNode: GraphShapeNode) => Rect

/**
 * Control-point AABB (+ pad) for a shape node when Views are unavailable.
 * @param shapeNode - shape-node element.
 */
export function shapeNodePointBounds(shapeNode: GraphShapeNode): Rect {
  let box: Rect | undefined
  for (const point of shapeNode.points) {
    box = unionPoint(box, point)
  }
  return growRect(
    box ?? { x: 0, y: 0, width: 0, height: 0 },
    SHAPE_NODE_FALLBACK_PAD,
  )
}

/**
 * Whether a group paints as an expanded band.
 * Omitted `expanded` is collapsed (`false`).
 * @param group - graph element.
 */
export function isGroupExpanded(group: GraphGroup): boolean {
  return group.expanded === true
}

/**
 * Parent group when `parentId` resolves, else undefined.
 * @param scene - live scene.
 * @param group - child group.
 */
export function parentGroupOf(
  scene: GraphScene,
  group: GraphGroup,
): GraphGroup | undefined {
  if (group.parentId === undefined) return undefined
  return scene.groups.get(group.parentId)
}

/**
 * Resolve the immediate group that owns a node (`groupId` or `memberIds`).
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
    if (group.memberIds.includes(nodeId) && scene.nodes.has(nodeId)) return group
  }
  return undefined
}

/**
 * Resolve the immediate group that owns a shape node (`groupId` or `memberIds`).
 * @param scene - live scene.
 * @param shapeNodeId - shape-node id.
 */
export function findGroupForShapeNode(
  scene: GraphScene,
  shapeNodeId: string,
): GraphGroup | undefined {
  const shapeNode = scene.shapeNodes.get(shapeNodeId)
  if (shapeNode?.groupId !== undefined) {
    const byId = scene.groups.get(shapeNode.groupId)
    if (byId !== undefined) return byId
  }
  for (const group of scene.groups.values()) {
    if (group.memberIds.includes(shapeNodeId) && scene.shapeNodes.has(shapeNodeId)) {
      return group
    }
  }
  return undefined
}

/**
 * Owning group id then each ancestor via `parentId` (inner → outer).
 * Used when member geometry changes so auto-fit bands and group-endpoint edges refresh.
 * @param scene - live scene.
 * @param nodeId - node id.
 */
export function listOwningGroupChain(scene: GraphScene, nodeId: string): readonly string[] {
  const ids: string[] = []
  let group = findGroupForNode(scene, nodeId)
  while (group !== undefined) {
    ids.push(group.id)
    group = parentGroupOf(scene, group)
  }
  return ids
}

/**
 * Owning group id then each ancestor for a shape-node member (inner → outer).
 * @param scene - live scene.
 * @param shapeNodeId - shape-node id.
 */
export function listOwningGroupChainForShapeNode(
  scene: GraphScene,
  shapeNodeId: string,
): readonly string[] {
  const ids: string[] = []
  let group = findGroupForShapeNode(scene, shapeNodeId)
  while (group !== undefined) {
    ids.push(group.id)
    group = parentGroupOf(scene, group)
  }
  return ids
}

/**
 * Nearest collapsed ancestor group containing the node (walks `parentId`).
 * @param scene - live scene.
 * @param nodeId - node id.
 */
export function collapsedGroupForNode(
  scene: GraphScene,
  nodeId: string,
): GraphGroup | undefined {
  let group = findGroupForNode(scene, nodeId)
  while (group !== undefined) {
    if (!isGroupExpanded(group)) return group
    group = parentGroupOf(scene, group)
  }
  return undefined
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
 * Whether the group should be painted and hit-tested (ancestors expanded).
 * @param scene - live scene.
 * @param groupId - group id.
 */
export function isGroupVisibleInScene(scene: GraphScene, groupId: string): boolean {
  let parent = scene.groups.get(groupId)
  if (parent === undefined) return false
  parent = parentGroupOf(scene, parent)
  while (parent !== undefined) {
    if (!isGroupExpanded(parent)) return false
    parent = parentGroupOf(scene, parent)
  }
  return true
}

/**
 * Direct child groups (`parentId` match ∪ `memberIds` group ids).
 * @param scene - live scene.
 * @param group - parent group.
 */
export function listChildGroups(scene: GraphScene, group: GraphGroup): GraphGroup[] {
  const seen = new Set<string>()
  const out: GraphGroup[] = []
  for (const id of group.memberIds) {
    const child = scene.groups.get(id)
    if (child === undefined || seen.has(id)) continue
    seen.add(id)
    out.push(child)
  }
  for (const child of scene.groups.values()) {
    if (child.parentId !== group.id || seen.has(child.id)) continue
    seen.add(child.id)
    out.push(child)
  }
  return out
}

/**
 * Direct member nodes only (`memberIds` ∪ `groupId` matches; skips group ids).
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
 * Direct member shape nodes (`memberIds` ∪ `groupId` matches).
 * @param scene - live scene.
 * @param group - group element.
 */
export function listGroupShapeNodes(
  scene: GraphScene,
  group: GraphGroup,
): GraphShapeNode[] {
  const seen = new Set<string>()
  const out: GraphShapeNode[] = []
  for (const id of group.memberIds) {
    const shapeNode = scene.shapeNodes.get(id)
    if (shapeNode === undefined || seen.has(id)) continue
    seen.add(id)
    out.push(shapeNode)
  }
  for (const shapeNode of scene.shapeNodes.values()) {
    if (shapeNode.groupId !== group.id || seen.has(shapeNode.id)) continue
    seen.add(shapeNode.id)
    out.push(shapeNode)
  }
  return out
}

/**
 * All descendant node ids under a group (nested groups included).
 * @param scene - live scene.
 * @param group - root group.
 */
export function listDescendantNodeIds(scene: GraphScene, group: GraphGroup): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (g: GraphGroup): void => {
    for (const node of listGroupMembers(scene, g)) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      out.push(node.id)
    }
    for (const child of listChildGroups(scene, g)) visit(child)
  }
  visit(group)
  return out
}

/**
 * All descendant group ids (not including `group` itself).
 * @param scene - live scene.
 * @param group - root group.
 */
export function listDescendantGroupIds(scene: GraphScene, group: GraphGroup): string[] {
  const out: string[] = []
  const visit = (g: GraphGroup): void => {
    for (const child of listChildGroups(scene, g)) {
      out.push(child.id)
      visit(child)
    }
  }
  visit(group)
  return out
}

/**
 * Reject `parentId` cycles. Throws when a cycle is present.
 * @param scene - live scene.
 * @param groupId - group to check.
 * @param parentId - proposed or current parent.
 */
export function assertGroupParentAcyclic(
  scene: GraphScene,
  groupId: string,
  parentId: string | undefined,
): void {
  if (parentId === undefined) return
  if (parentId === groupId) {
    throw new Error(`GraphGroup ${groupId}: parentId cannot reference itself`)
  }
  let walk: string | undefined = parentId
  const seen = new Set<string>([groupId])
  while (walk !== undefined) {
    if (seen.has(walk)) {
      throw new Error(`GraphGroup ${groupId}: parentId cycle via ${walk}`)
    }
    seen.add(walk)
    walk = scene.groups.get(walk)?.parentId
  }
}

/**
 * Center of an AABB.
 * @param rect - world rect.
 */
export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/**
 * Member union (no padding), or undefined when empty. Includes child group bands
 * and shape-node members.
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver for boxed nodes.
 * @param shapeNodeBoundsOf - optional paint-extent resolver for shape nodes.
 */
export function memberUnionBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf: MemberBoundsResolver = nodeBounds,
  shapeNodeBoundsOf: ShapeNodeBoundsResolver = shapeNodePointBounds,
): Rect | undefined {
  let union: Rect | undefined
  for (const node of listGroupMembers(scene, group)) {
    union = unionRect(union, memberBoundsOf(node))
  }
  for (const shapeNode of listGroupShapeNodes(scene, group)) {
    if (shapeNode.points.length < 2) continue
    union = unionRect(union, shapeNodeBoundsOf(shapeNode))
  }
  for (const child of listChildGroups(scene, group)) {
    union = unionRect(
      union,
      computeGroupBandBounds(scene, child, memberBoundsOf, shapeNodeBoundsOf),
    )
  }
  return union
}

/**
 * Expanded auto-fit band from current member positions (ignores `expanded` flag).
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver for boxed nodes.
 * @param shapeNodeBoundsOf - optional paint-extent resolver for shape nodes.
 */
export function computeExpandedBandBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf?: MemberBoundsResolver,
  shapeNodeBoundsOf?: ShapeNodeBoundsResolver,
): Rect {
  const union = memberUnionBounds(
    scene,
    group,
    memberBoundsOf ?? nodeBounds,
    shapeNodeBoundsOf ?? shapeNodePointBounds,
  )
  if (union === undefined) return groupBounds(group)
  return growRectInsets(union, resolveGroupPadding(group))
}

/**
 * Auto-fit insets. Uniform `padding` on all sides unless `paddingTop` is set
 * (skill/docs opt in for insideTop title clearance — engine does not invent it).
 * @param group - group element.
 */
export function resolveGroupPadding(group: GraphGroup): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const base = group.style?.padding ?? DEFAULT_GROUP_PADDING
  const top = group.style?.paddingTop ?? base
  return { top, right: base, bottom: base, left: base }
}

/**
 * Suggested top pad for an insideTop title stack (authors copy into `style.paddingTop`).
 * Not applied automatically — keeps demo auto-fit unchanged unless opted in.
 * @param group - group element.
 */
export function suggestedGroupTopPadding(group: GraphGroup): number {
  const titleSize = group.style?.label?.fontSize ?? 12
  const titleH = titleSize * 1.2
  let need = GROUP_TITLE_INSET + titleH + GROUP_TITLE_MEMBER_GAP
  if (typeof group.label2 === 'string' && group.label2.length > 0) {
    const subSize = group.style?.label2?.fontSize ?? 10
    need = GROUP_TITLE_INSET + titleH + 2 + subSize * 1.2 + GROUP_TITLE_MEMBER_GAP
  }
  return Math.ceil(need)
}

/**
 * Band body rectangle: document geometry when collapsed or `autoFit: false`;
 * otherwise member union + padding (fallback to document when empty).
 * @param scene - live scene.
 * @param group - group element.
 * @param memberBoundsOf - optional paint-extent resolver for boxed nodes.
 * @param shapeNodeBoundsOf - optional paint-extent resolver for shape nodes.
 */
export function computeGroupBandBounds(
  scene: GraphScene,
  group: GraphGroup,
  memberBoundsOf?: MemberBoundsResolver,
  shapeNodeBoundsOf?: ShapeNodeBoundsResolver,
): Rect {
  const autoFit = group.style?.autoFit !== false
  if (!isGroupExpanded(group) || !autoFit) {
    return groupBounds(group)
  }
  return computeExpandedBandBounds(scene, group, memberBoundsOf, shapeNodeBoundsOf)
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
 * - collapse: park the collapsed body (document `w`/`h`, else 50×50) centered on
 *   the expanded band; do not overwrite authored `w`/`h` with the band size
 * - expand: translate members (nodes + nested groups) so the auto-fit band
 *   centers on the collapsed body center
 * @param scene - live scene.
 * @param group - group before toggle.
 * @param nextExpanded - target expanded flag.
 * @param memberBoundsOf - optional paint-extent resolver for boxed nodes
 *   (must match the painted band).
 * @param shapeNodeBoundsOf - optional paint-extent resolver for shape nodes.
 */
export function expandCollapseCenterPatches(
  scene: GraphScene,
  group: GraphGroup,
  nextExpanded: boolean,
  memberBoundsOf?: MemberBoundsResolver,
  shapeNodeBoundsOf?: ShapeNodeBoundsResolver,
): {
  readonly groupPatch: {
    expanded: boolean
    x?: number
    y?: number
    w?: number
    h?: number
  }
  readonly memberMoves: readonly {
    id: string
    from: Point
    to: Point
  }[]
  readonly childGroupMoves: readonly {
    id: string
    from: Point
    to: Point
  }[]
} {
  if (!nextExpanded) {
    const band = computeExpandedBandBounds(
      scene,
      group,
      memberBoundsOf,
      shapeNodeBoundsOf,
    )
    const origin = collapsedOriginForCenter(group, rectCenter(band))
    return {
      groupPatch: {
        expanded: false,
        x: origin.x,
        y: origin.y,
      },
      memberMoves: [],
      childGroupMoves: [],
    }
  }

  const center = rectCenter(groupBounds(group))
  const band = computeExpandedBandBounds(
    scene,
    group,
    memberBoundsOf,
    shapeNodeBoundsOf,
  )
  const current = rectCenter(band)
  const dx = center.x - current.x
  const dy = center.y - current.y
  const memberMoves = listDescendantNodeIds(scene, group).map(id => {
    const node = scene.nodes.get(id)!
    const from = { x: node.x ?? 0, y: node.y ?? 0 }
    return { id, from, to: { x: from.x + dx, y: from.y + dy } }
  })
  const childGroupMoves = listDescendantGroupIds(scene, group).map(id => {
    const child = scene.groups.get(id)!
    const from = { x: child.x ?? 0, y: child.y ?? 0 }
    return { id, from, to: { x: from.x + dx, y: from.y + dy } }
  })
  return {
    groupPatch: {
      expanded: true,
      ...(group.x !== undefined ? { x: group.x } : { x: groupBounds(group).x }),
      ...(group.y !== undefined ? { y: group.y } : { y: groupBounds(group).y }),
    },
    memberMoves,
    childGroupMoves,
  }
}

/**
 * Group expand/collapse and band geometry helpers shared by views.
 */

import { growRect, unionRect, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphGroup } from '../protocol/types.ts'
import { groupBounds, nodeBounds } from './bounds.ts'

/** Default padding around member union when auto-fitting (world px). */
export const DEFAULT_GROUP_PADDING = 16

/**
 * Whether a group paints as an expanded band.
 * Omitted `expanded` is collapsed (`false`).
 * @param group - group element.
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
 * Band body rectangle: document geometry when collapsed or `autoFit: false`;
 * otherwise member body union + padding (fallback to document when empty).
 * @param scene - live scene.
 * @param group - group element.
 */
export function computeGroupBandBounds(scene: GraphScene, group: GraphGroup): Rect {
  const autoFit = group.style?.autoFit !== false
  if (!isGroupExpanded(group) || !autoFit) {
    return groupBounds(group)
  }
  let union: Rect | undefined
  const memberSet = new Set(group.memberIds)
  for (const id of memberSet) {
    const node = scene.nodes.get(id)
    if (node === undefined) continue
    union = unionRect(union, nodeBounds(node))
  }
  for (const node of scene.nodes.values()) {
    if (node.groupId !== group.id || memberSet.has(node.id)) continue
    union = unionRect(union, nodeBounds(node))
  }
  if (union === undefined) return groupBounds(group)
  const padding = group.style?.padding ?? DEFAULT_GROUP_PADDING
  return growRect(union, padding)
}

/**
 * Resolve GraphEdge from/to ids to paint boxes (node or group).
 */

import type { Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import { nodeBounds } from './bounds.ts'
import { collapsedGroupForNode, computeGroupBandBounds } from './group-state.ts'

/** Resolved edge endpoint for routing. */
export type EdgeEndpoint =
  | {
    readonly kind: 'node'
    readonly id: string
    readonly box: Rect
    /** Nearest collapsed ancestor when member-penetration remaps the node. */
    readonly remappedGroupId?: string
  }
  | {
    readonly kind: 'group'
    readonly id: string
    readonly box: Rect
  }

/**
 * Resolve an edge endpoint id: node first, then group.
 * Node endpoints apply collapse remap to the nearest collapsed ancestor band.
 * @param scene - live scene.
 * @param id - node or group id.
 * @returns endpoint, or undefined when neither exists.
 */
export function resolveEdgeEndpoint(
  scene: GraphScene,
  id: string,
): EdgeEndpoint | undefined {
  const node = scene.nodes.get(id)
  if (node !== undefined) {
    const collapsed = collapsedGroupForNode(scene, id)
    if (collapsed !== undefined) {
      return {
        kind: 'node',
        id,
        box: computeGroupBandBounds(scene, collapsed),
        remappedGroupId: collapsed.id,
      }
    }
    return { kind: 'node', id, box: nodeBounds(node) }
  }
  const group = scene.groups.get(id)
  if (group !== undefined) {
    return {
      kind: 'group',
      id,
      box: computeGroupBandBounds(scene, group),
    }
  }
  return undefined
}

/**
 * Whether both endpoints exist as a node or a group in the document maps.
 * @param nodes - node id set.
 * @param groups - group id set.
 * @param id - endpoint id.
 */
export function endpointExistsInMaps(
  nodes: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  groups: ReadonlySet<string> | ReadonlyMap<string, unknown> | undefined,
  id: string,
): boolean {
  if ('has' in nodes && nodes.has(id)) return true
  if (groups !== undefined && 'has' in groups && groups.has(id)) return true
  return false
}

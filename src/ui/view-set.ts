/**
 * Owns Node/Edge/Group/Path Views synced to GraphScene membership.
 */

import type { Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphNode } from '../protocol/types.ts'
import { nodeBounds } from './bounds.ts'
import {
  bundleFanOffset,
  DEFAULT_BUNDLE_GAP,
} from './edge-link-route.ts'
import { EdgeView } from './edge-view.ts'
import {
  listDescendantGroupIds,
  listDescendantNodeIds,
  listOwningGroupChain,
} from './group-state.ts'
import { GroupView } from './group-view.ts'
import { NodeView } from './node-view.ts'
import { PathView } from './path-view.ts'

/**
 * Create/dispose Views to match the scene and track geometry dirty flags.
 */
export class ViewSet {
  private readonly nodes = new Map<string, NodeView>()
  private readonly edges = new Map<string, EdgeView>()
  private readonly groups = new Map<string, GroupView>()
  private readonly paths = new Map<string, PathView>()
  /** Host default when `style.showIcon` is omitted (default true). */
  private showNodeIconsDefault = true

  /**
   * Set host default for icon visibility; dirties all node views.
   * @param value - whether icons show when style.showIcon is omitted.
   */
  setShowNodeIconsDefault(value: boolean): void {
    if (this.showNodeIconsDefault === value) return
    this.showNodeIconsDefault = value
    for (const view of this.nodes.values()) view.markDirty()
  }

  /** Dispose all Views and recreate from the scene. */
  rebuild(scene: GraphScene): void {
    this.nodes.clear()
    this.edges.clear()
    this.groups.clear()
    this.paths.clear()
    for (const id of scene.nodes.keys()) this.nodes.set(id, new NodeView(id))
    for (const id of scene.edges.keys()) this.edges.set(id, new EdgeView(id))
    for (const id of scene.groups.keys()) this.groups.set(id, new GroupView(id))
    for (const id of scene.paths.keys()) this.paths.set(id, new PathView(id))
  }

  /**
   * Add/remove Views so maps match the scene; new Views start dirty.
   * @param scene - active graph scene.
   */
  sync(scene: GraphScene): void {
    syncMap(this.nodes, scene.nodes.keys(), id => new NodeView(id))
    syncMap(this.edges, scene.edges.keys(), id => new EdgeView(id))
    syncMap(this.groups, scene.groups.keys(), id => new GroupView(id))
    syncMap(this.paths, scene.paths.keys(), id => new PathView(id))
  }

  /**
   * Mark a View dirty by element id (node, edge, group, or path).
   * @param id - element id.
   */
  markDirty(id: string): void {
    this.nodes.get(id)?.markDirty()
    this.edges.get(id)?.markDirty()
    this.groups.get(id)?.markDirty()
    this.paths.get(id)?.markDirty()
  }

  /**
   * Mark a node and every incident edge dirty after a geometry move.
   * Also dirties owning groups (and ancestors) so auto-fit bands recompute,
   * plus edges whose endpoints are those group ids.
   * @param scene - active graph scene.
   * @param nodeId - moved node id.
   */
  markNodeGeometryDirty(scene: GraphScene, nodeId: string): void {
    this.nodes.get(nodeId)?.markDirty()
    for (const edge of scene.edges.values()) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.edges.get(edge.id)?.markDirty()
      }
    }
    for (const groupId of listOwningGroupChain(scene, nodeId)) {
      this.groups.get(groupId)?.markDirty()
      for (const edge of scene.edges.values()) {
        if (edge.from === groupId || edge.to === groupId) {
          this.edges.get(edge.id)?.markDirty()
        }
      }
    }
  }

  /**
   * Validate every dirty View against the live scene. Groups auto-fit from
   * member paint extents (body ∪ attachments), so nodes validate first.
   * Paths validate independently (no endpoint remapping).
   * @param scene - active graph scene.
   * @param paintOpts - optional flow phase for animated dashes.
   */
  validateDirty(
    scene: GraphScene,
    paintOpts?: { readonly flowPhase?: number },
  ): void {
    const opts = { showNodeIconsDefault: this.showNodeIconsDefault }
    // Paths first (under everything), then nodes (member unions), groups, edges.
    for (const view of this.paths.values()) {
      view.validate(scene.paths.get(view.id))
    }
    for (const view of this.nodes.values()) view.validate(scene, opts)
    for (const view of this.groups.values()) view.validate(scene, n => this.nodeUnionBounds(n))
    const fan = computeBundleFanOffsets(scene)
    const flowPhase = paintOpts?.flowPhase ?? 0
    for (const view of this.edges.values()) {
      view.setPaintExtras({
        bundleYOffset: fan.get(view.id) ?? 0,
        flowPhase,
      })
      view.validate(scene)
    }
  }

  /** True when any active edge requested flow animation. */
  hasFlowingEdges(scene: GraphScene): boolean {
    for (const edge of scene.edges.values()) {
      if (edge.style?.flow === true) {
        const view = this.edges.get(edge.id)
        if (view?.isActive) return true
        if (view === undefined) return true
      }
    }
    return false
  }

  /**
   * Attachment-inclusive paint extents of a node from its validated View.
   * Falls back to the bare body only before `sync`/`rebuild` has seen the node.
   * @param node - member node.
   */
  nodeUnionBounds(node: GraphNode): Rect {
    const view = this.nodes.get(node.id)
    return view === undefined ? nodeBounds(node) : view.unionBounds
  }

  /**
   * Mark a group, its members, and incident edges dirty after expand/collapse or move.
   * @param scene - active graph scene.
   * @param groupId - group id.
   */
  markGroupGeometryDirty(scene: GraphScene, groupId: string): void {
    this.groups.get(groupId)?.markDirty()
    const group = scene.groups.get(groupId)
    if (group === undefined) return
    for (const childId of listDescendantGroupIds(scene, group)) {
      this.groups.get(childId)?.markDirty()
    }
    const members = new Set(listDescendantNodeIds(scene, group))
    for (const memberId of members) {
      this.markNodeGeometryDirty(scene, memberId)
    }
    for (const edge of scene.edges.values()) {
      if (
        members.has(edge.from)
        || members.has(edge.to)
        || edge.from === groupId
        || edge.to === groupId
      ) {
        this.edges.get(edge.id)?.markDirty()
      }
    }
  }

  getNode(id: string): NodeView | undefined {
    return this.nodes.get(id)
  }

  getEdge(id: string): EdgeView | undefined {
    return this.edges.get(id)
  }

  getGroup(id: string): GroupView | undefined {
    return this.groups.get(id)
  }

  getPath(id: string): PathView | undefined {
    return this.paths.get(id)
  }

  /** Node Views in insertion order. */
  nodeViews(): IterableIterator<NodeView> {
    return this.nodes.values()
  }

  /** Edge Views in insertion order. */
  edgeViews(): IterableIterator<EdgeView> {
    return this.edges.values()
  }

  /** Group Views in insertion order. */
  groupViews(): IterableIterator<GroupView> {
    return this.groups.values()
  }

  /** Path Views in insertion order. */
  pathViews(): IterableIterator<PathView> {
    return this.paths.values()
  }
}

/**
 * Same directed (from,to) edges that opt into bundle fan-out get centered offsets.
 */
function computeBundleFanOffsets(scene: GraphScene): Map<string, number> {
  const groups = new Map<string, string[]>()
  for (const edge of scene.edges.values()) {
    if (edge.style?.bundle === false) continue
    if (edge.from === edge.to) continue
    const key = `${edge.from}\0${edge.to}`
    const list = groups.get(key)
    if (list === undefined) groups.set(key, [edge.id])
    else list.push(edge.id)
  }
  const out = new Map<string, number>()
  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    ids.sort()
    const gap = scene.edges.get(ids[0]!)?.style?.bundleGap ?? DEFAULT_BUNDLE_GAP
    for (let i = 0; i < ids.length; i += 1) {
      out.set(ids[i]!, bundleFanOffset(i, ids.length, gap))
    }
  }
  return out
}

function syncMap<T extends { markDirty(): void }>(
  map: Map<string, T>,
  ids: Iterable<string>,
  create: (id: string) => T,
): void {
  const keep = new Set(ids)
  for (const id of [...map.keys()]) {
    if (!keep.has(id)) map.delete(id)
  }
  for (const id of keep) {
    if (map.has(id)) continue
    map.set(id, create(id))
  }
}

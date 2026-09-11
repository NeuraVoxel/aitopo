/**
 * Owns Node/Edge/Group Views synced to GraphScene membership.
 */

import type { GraphScene } from '../model/scene.ts'
import { EdgeView } from './edge-view.ts'
import { GroupView } from './group-view.ts'
import { NodeView } from './node-view.ts'

/**
 * Create/dispose Views to match the scene and track geometry dirty flags.
 */
export class ViewSet {
  private readonly nodes = new Map<string, NodeView>()
  private readonly edges = new Map<string, EdgeView>()
  private readonly groups = new Map<string, GroupView>()
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
    for (const id of scene.nodes.keys()) this.nodes.set(id, new NodeView(id))
    for (const id of scene.edges.keys()) this.edges.set(id, new EdgeView(id))
    for (const id of scene.groups.keys()) this.groups.set(id, new GroupView(id))
  }

  /**
   * Add/remove Views so maps match the scene; new Views start dirty.
   * @param scene - active graph scene.
   */
  sync(scene: GraphScene): void {
    syncMap(this.nodes, scene.nodes.keys(), id => new NodeView(id))
    syncMap(this.edges, scene.edges.keys(), id => new EdgeView(id))
    syncMap(this.groups, scene.groups.keys(), id => new GroupView(id))
  }

  /**
   * Mark a View dirty by element id (node, edge, or group).
   * @param id - element id.
   */
  markDirty(id: string): void {
    this.nodes.get(id)?.markDirty()
    this.edges.get(id)?.markDirty()
    this.groups.get(id)?.markDirty()
  }

  /**
   * Mark a node and every incident edge dirty after a geometry move.
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
  }

  /**
   * Validate every dirty View against the live scene.
   * @param scene - active graph scene.
   */
  validateDirty(scene: GraphScene): void {
    const opts = { showNodeIconsDefault: this.showNodeIconsDefault }
    for (const view of this.nodes.values()) view.validate(scene, opts)
    for (const view of this.edges.values()) view.validate(scene)
    for (const view of this.groups.values()) view.validate(scene)
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

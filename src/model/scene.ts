/**
 * Scene apply uses validated GraphPatch; navigation ops are handled by Network.
 */

import { expandFollowMotion, translateFollowersLive } from './follow.ts'
import {
  listPaintLayers,
  resolveLayer,
} from './layer.ts'
import { applyPatch as applyDocumentPatch, type GraphPatch } from '../protocol/patch.ts'
import { graphPatchSchema } from '../protocol/schema.ts'
import { parseDocument } from '../protocol/parse.ts'
import type {
  Alarm,
  GraphDocument,
  GraphEdge,
  GraphGroup,
  GraphLayer,
  GraphNode,
  GraphPath,
  GraphShapeNode,
  GraphViewport,
} from '../protocol/types.ts'

/** Snapshot of scene dirty tracking. */
export interface DirtyState {
  readonly invalidateAll: boolean
  readonly ids: ReadonlySet<string>
}

/**
 * In-memory scene driven exclusively by load / apply / layout / subnetwork navigation.
 */
export class GraphScene {
  private rootDocument: GraphDocument = emptyDocument()
  private active: GraphDocument = emptyDocument()
  private readonly nodeMap = new Map<string, GraphNode>()
  private readonly edgeMap = new Map<string, GraphEdge>()
  private readonly groupMap = new Map<string, GraphGroup>()
  private readonly pathMap = new Map<string, GraphPath>()
  private readonly shapeNodeMap = new Map<string, GraphShapeNode>()
  private readonly outEdges = new Map<string, string[]>()
  private readonly inEdges = new Map<string, string[]>()
  private sceneVersion = 0
  private invalidateAll = true
  private readonly dirtyIds = new Set<string>()
  /**
   * Path of entered SubNetwork ids from root (empty at root).
   * Tip is the active child; lookup is always against the parent document's `networks`.
   */
  private networkStackIds: string[] = []
  private selection = new Set<string>()
  private hoverId: string | undefined
  private viewport: GraphViewport = { x: 0, y: 0, zoom: 1 }

  /** Monotonic version bumped on durable scene commits. */
  get version(): number {
    return this.sceneVersion
  }

  /** Active SubNetwork id (stack tip), or null at root. */
  get currentNetworkId(): string | null {
    const tip = this.networkStackIds[this.networkStackIds.length - 1]
    return tip === undefined ? null : tip
  }

  /** Entered network ids under root (empty at root; depth ≥ 1 when drilled). */
  get networkStack(): readonly string[] {
    return this.networkStackIds
  }

  get nodes(): ReadonlyMap<string, GraphNode> {
    return this.nodeMap
  }

  get edges(): ReadonlyMap<string, GraphEdge> {
    return this.edgeMap
  }

  get groups(): ReadonlyMap<string, GraphGroup> {
    return this.groupMap
  }

  get paths(): ReadonlyMap<string, GraphPath> {
    return this.pathMap
  }

  get shapeNodes(): ReadonlyMap<string, GraphShapeNode> {
    return this.shapeNodeMap
  }

  /**
   * Paint layers bottom → top (synthetic default when document omits `layers`).
   */
  get paintLayers(): readonly GraphLayer[] {
    return listPaintLayers(this.active)
  }

  /**
   * Resolve the layer policy for an element id.
   * @param elementId - node / edge / group / path / shapeNode id.
   */
  layerOf(elementId: string): GraphLayer {
    return resolveLayer(this.active, this.layerIdOf(elementId))
  }

  /**
   * Raw `layerId` on the element, or undefined when omitted / unknown id.
   * @param elementId - element id.
   */
  layerIdOf(elementId: string): string | undefined {
    return this.nodeMap.get(elementId)?.layerId
      ?? this.edgeMap.get(elementId)?.layerId
      ?? this.groupMap.get(elementId)?.layerId
      ?? this.pathMap.get(elementId)?.layerId
      ?? this.shapeNodeMap.get(elementId)?.layerId
  }

  get selectedIds(): ReadonlySet<string> {
    return this.selection
  }

  get hover(): string | undefined {
    return this.hoverId
  }

  get camera(): GraphViewport {
    return this.viewport
  }

  /**
   * Replace the root document and reset SubNetwork to root.
   * @param input - unknown JSON or GraphDocument.
   */
  load(input: unknown): void {
    const doc = parseDocument(input)
    this.rootDocument = structuredClone(doc)
    this.networkStackIds = []
    this.commitActive(this.rootDocument, true)
    if (doc.viewport !== undefined) {
      this.viewport = { ...doc.viewport }
    }
  }

  /**
   * Apply a document patch atomically to the active network.
   * @param patch - validated GraphPatch (no SubNetwork navigation).
   */
  apply(patch: GraphPatch): void {
    const parsed = graphPatchSchema.parse(patch)
    const expanded = expandFollowMotion(this.active, parsed)
    const before = this.sceneVersion
    const dirty = collectPatchDirty(this.active, expanded.ops)
    const next = applyDocumentPatch(this.active, expanded)
    this.commitActive(next, dirty.invalidateAll, dirty.ids)
    this.rootDocument = writeDocAtStack(this.rootDocument, this.networkStackIds, next)
    if (next.viewport !== undefined) {
      this.viewport = { ...next.viewport }
    }
    if (this.sceneVersion === before) {
      this.sceneVersion += 1
    }
  }

  /** Project the active network as a GraphDocument. */
  toJSON(): GraphDocument {
    const nodes = [...this.nodeMap.values()]
    const edges = [...this.edgeMap.values()]
    const groups = [...this.groupMap.values()]
    const paths = [...this.pathMap.values()]
    const shapeNodes = [...this.shapeNodeMap.values()]
    const base: GraphDocument = {
      version: 1,
      nodes,
      edges,
      viewport: this.viewport,
      ...(this.active.layers !== undefined ? { layers: this.active.layers } : {}),
      ...(groups.length > 0 ? { groups } : {}),
      ...(paths.length > 0 ? { paths } : {}),
      ...(shapeNodes.length > 0 ? { shapeNodes } : {}),
    }
    if (this.networkStackIds.length === 0) {
      return {
        ...base,
        ...(this.rootDocument.meta !== undefined ? { meta: this.rootDocument.meta } : {}),
        ...(this.rootDocument.networks !== undefined ? { networks: this.rootDocument.networks } : {}),
      }
    }
    return {
      ...base,
      ...(this.active.meta !== undefined ? { meta: this.active.meta } : {}),
      ...(this.active.networks !== undefined ? { networks: this.active.networks } : {}),
    }
  }

  /**
   * Flush the active leaf into the root tree and return a deep clone of the
   * full document (all nested `networks` included). Prefer this for host export.
   */
  toRootJSON(): GraphDocument {
    this.syncActiveFromMaps()
    this.rootDocument = writeDocAtStack(
      this.rootDocument,
      this.networkStackIds,
      this.active,
    )
    return structuredClone(this.rootDocument)
  }

  /**
   * Enter a child network of the **current** document (`active.networks[id]`).
   * Supports a stack (root → child → grandchild → …).
   * @param id - key in the current document's `networks`.
   */
  enterSubNetwork(id: string): void {
    if (this.networkStackIds.includes(id)) {
      throw new Error(`enterSubNetwork: cycle involving ${id}`)
    }
    const child = this.active.networks?.[id]
    if (child === undefined) {
      throw new Error(`enterSubNetwork: missing network ${id}`)
    }
    this.networkStackIds = [...this.networkStackIds, id]
    this.commitActive(structuredClone(child), true)
  }

  /** Pop one SubNetwork level (grandchild → parent, or child → root). */
  exitSubNetwork(): void {
    if (this.networkStackIds.length === 0) {
      throw new Error('exitSubNetwork: already at root')
    }
    this.networkStackIds = this.networkStackIds.slice(0, -1)
    const doc = resolveDocAtStack(this.rootDocument, this.networkStackIds)
    this.commitActive(structuredClone(doc), true)
  }

  /**
   * Replace node coordinates (layout write path).
   * @param positions - id → x/y.
   */
  writePositions(positions: Readonly<Record<string, { x: number; y: number }>>): void {
    const skipIds = new Set(Object.keys(positions))
    const hostMoves: { id: string; dx: number; dy: number }[] = []
    for (const [id, pos] of Object.entries(positions)) {
      const node = this.nodeMap.get(id)
      if (node === undefined) continue
      const dx = pos.x - (node.x ?? 0)
      const dy = pos.y - (node.y ?? 0)
      this.nodeMap.set(id, { ...node, x: pos.x, y: pos.y })
      this.markDirty(id)
      if (dx !== 0 || dy !== 0) hostMoves.push({ id, dx, dy })
    }
    for (const move of hostMoves) {
      translateFollowersLive({
        hostId: move.id,
        dx: move.dx,
        dy: move.dy,
        skipIds,
        nodes: this.nodeMap,
        groups: this.groupMap,
        paths: this.pathMap,
        shapeNodes: this.shapeNodeMap,
        markDirty: id => this.markDirty(id),
      })
    }
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace group band origin (live group-drag preview).
   * @param positions - group id → x/y.
   */
  writeGroupPositions(positions: Readonly<Record<string, { x: number; y: number }>>): void {
    const skipIds = new Set(Object.keys(positions))
    const hostMoves: { id: string; dx: number; dy: number }[] = []
    for (const [id, pos] of Object.entries(positions)) {
      const group = this.groupMap.get(id)
      if (group === undefined) continue
      const dx = pos.x - (group.x ?? 0)
      const dy = pos.y - (group.y ?? 0)
      this.groupMap.set(id, { ...group, x: pos.x, y: pos.y })
      this.markDirty(id)
      if (dx !== 0 || dy !== 0) hostMoves.push({ id, dx, dy })
    }
    for (const move of hostMoves) {
      translateFollowersLive({
        hostId: move.id,
        dx: move.dx,
        dy: move.dy,
        skipIds,
        nodes: this.nodeMap,
        groups: this.groupMap,
        paths: this.pathMap,
        shapeNodes: this.shapeNodeMap,
        markDirty: id => this.markDirty(id),
      })
    }
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace node bounds (live resize preview path).
   * @param bounds - id → x/y/w/h.
   */
  writeBounds(bounds: Readonly<Record<string, { x: number; y: number; w: number; h: number }>>): void {
    const skipIds = new Set(Object.keys(bounds))
    const hostMoves: { id: string; dx: number; dy: number }[] = []
    for (const [id, box] of Object.entries(bounds)) {
      const node = this.nodeMap.get(id)
      if (node === undefined) continue
      const dx = box.x - (node.x ?? 0)
      const dy = box.y - (node.y ?? 0)
      this.nodeMap.set(id, { ...node, x: box.x, y: box.y, w: box.w, h: box.h })
      this.markDirty(id)
      if (dx !== 0 || dy !== 0) hostMoves.push({ id, dx, dy })
    }
    for (const move of hostMoves) {
      translateFollowersLive({
        hostId: move.id,
        dx: move.dx,
        dy: move.dy,
        skipIds,
        nodes: this.nodeMap,
        groups: this.groupMap,
        paths: this.pathMap,
        shapeNodes: this.shapeNodeMap,
        markDirty: id => this.markDirty(id),
      })
    }
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace edge bend waypoints (live bend preview path).
   * Empty array clears custom routing (auto orthogonal).
   * @param edgeId - edge id.
   * @param waypoints - intermediate points.
   */
  writeEdgeWaypoints(
    edgeId: string,
    waypoints: readonly { readonly x: number; readonly y: number }[],
  ): void {
    const edge = this.edgeMap.get(edgeId)
    if (edge === undefined) return
    const next = waypoints.length === 0
      ? (() => {
          const { waypoints: _drop, ...rest } = edge
          void _drop
          return rest
        })()
      : { ...edge, waypoints: waypoints.map(p => ({ x: p.x, y: p.y })) }
    this.edgeMap.set(edgeId, next)
    this.markDirty(edgeId)
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace path control points (live path-body / vertex preview).
   * @param pathId - path id.
   * @param points - control points (≥2 expected by callers).
   */
  writePathPoints(
    pathId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void {
    const path = this.pathMap.get(pathId)
    if (path === undefined) return
    const from = path.points[0]
    const to = points[0]
    const dx = from !== undefined && to !== undefined ? to.x - from.x : 0
    const dy = from !== undefined && to !== undefined ? to.y - from.y : 0
    this.pathMap.set(pathId, {
      ...path,
      points: points.map(p => ({ x: p.x, y: p.y })),
    })
    this.markDirty(pathId)
    translateFollowersLive({
      hostId: pathId,
      dx,
      dy,
      skipIds: new Set([pathId]),
      nodes: this.nodeMap,
      groups: this.groupMap,
      paths: this.pathMap,
      shapeNodes: this.shapeNodeMap,
      markDirty: id => this.markDirty(id),
    })
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace shape-node control points (live body / vertex preview).
   * @param shapeNodeId - shape-node id.
   * @param points - control points (≥2 expected by callers).
   */
  writeShapeNodePoints(
    shapeNodeId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void {
    const shapeNode = this.shapeNodeMap.get(shapeNodeId)
    if (shapeNode === undefined) return
    const from = shapeNode.points[0]
    const to = points[0]
    const dx = from !== undefined && to !== undefined ? to.x - from.x : 0
    const dy = from !== undefined && to !== undefined ? to.y - from.y : 0
    this.shapeNodeMap.set(shapeNodeId, {
      ...shapeNode,
      points: points.map(p => ({ x: p.x, y: p.y })),
    })
    this.markDirty(shapeNodeId)
    translateFollowersLive({
      hostId: shapeNodeId,
      dx,
      dy,
      skipIds: new Set([shapeNodeId]),
      nodes: this.nodeMap,
      groups: this.groupMap,
      paths: this.pathMap,
      shapeNodes: this.shapeNodeMap,
      markDirty: id => this.markDirty(id),
    })
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  /**
   * Replace element angle (live rotate preview). Degrees; writers normalize.
   * @param kind - rotatable element kind.
   * @param id - element id.
   * @param angle - degrees.
   */
  writeElementAngle(
    kind: 'node' | 'group' | 'path' | 'shapeNode',
    id: string,
    angle: number,
  ): void {
    const normalized = ((angle % 360) + 360) % 360
    if (kind === 'node') {
      const node = this.nodeMap.get(id)
      if (node === undefined) return
      this.nodeMap.set(id, { ...node, angle: normalized })
    } else if (kind === 'group') {
      const group = this.groupMap.get(id)
      if (group === undefined) return
      this.groupMap.set(id, { ...group, angle: normalized })
    } else if (kind === 'path') {
      const path = this.pathMap.get(id)
      if (path === undefined) return
      this.pathMap.set(id, { ...path, angle: normalized })
    } else {
      const shapeNode = this.shapeNodeMap.get(id)
      if (shapeNode === undefined) return
      this.shapeNodeMap.set(id, { ...shapeNode, angle: normalized })
    }
    this.markDirty(id)
    this.sceneVersion += 1
    this.syncActiveFromMaps()
  }

  setSelection(ids: readonly string[]): void {
    this.selection = new Set(ids)
  }

  setHover(id: string | undefined): void {
    this.hoverId = id
  }

  setCamera(viewport: GraphViewport): void {
    this.viewport = { ...viewport }
    this.invalidateAll = true
  }

  /**
   * Mark element ids dirty for the next paint.
   * @param id - element id.
   */
  markDirty(id: string): void {
    this.dirtyIds.add(id)
  }

  /** Force a full-frame invalidate (camera / resize). */
  markInvalidateAll(): void {
    this.invalidateAll = true
  }

  /** Snapshot and clear dirty state for the paint loop. */
  takeDirty(): DirtyState {
    const state: DirtyState = {
      invalidateAll: this.invalidateAll,
      ids: new Set(this.dirtyIds),
    }
    this.invalidateAll = false
    this.dirtyIds.clear()
    return state
  }

  /**
   * Alarms for a node or edge.
   * @param id - element id.
   */
  alarmsOf(id: string): readonly Alarm[] {
    return this.nodeMap.get(id)?.alarms ?? this.edgeMap.get(id)?.alarms ?? []
  }

  private commitActive(
    doc: GraphDocument,
    full: boolean,
    partialDirtyIds: ReadonlySet<string> = new Set(),
  ): void {
    this.active = doc
    this.nodeMap.clear()
    this.edgeMap.clear()
    this.groupMap.clear()
    this.pathMap.clear()
    this.shapeNodeMap.clear()
    this.outEdges.clear()
    this.inEdges.clear()
    for (const node of doc.nodes) {
      this.nodeMap.set(node.id, node)
    }
    for (const edge of doc.edges) {
      this.edgeMap.set(edge.id, edge)
      pushIndex(this.outEdges, edge.from, edge.id)
      pushIndex(this.inEdges, edge.to, edge.id)
    }
    for (const group of doc.groups ?? []) {
      this.groupMap.set(group.id, group)
    }
    for (const path of doc.paths ?? []) {
      this.pathMap.set(path.id, path)
    }
    for (const shapeNode of doc.shapeNodes ?? []) {
      this.shapeNodeMap.set(shapeNode.id, shapeNode)
    }
    this.sceneVersion += 1
    if (full) {
      this.invalidateAll = true
      this.dirtyIds.clear()
      return
    }
    for (const id of partialDirtyIds) this.dirtyIds.add(id)
  }

  /** Rebuild `active` from maps without dropping meta / nested networks. */
  private syncActiveFromMaps(): void {
    this.active = {
      version: 1,
      nodes: [...this.nodeMap.values()],
      edges: [...this.edgeMap.values()],
      viewport: this.viewport,
      ...(this.active.layers !== undefined ? { layers: this.active.layers } : {}),
      ...(this.groupMap.size > 0 ? { groups: [...this.groupMap.values()] } : {}),
      ...(this.pathMap.size > 0 ? { paths: [...this.pathMap.values()] } : {}),
      ...(this.shapeNodeMap.size > 0
        ? { shapeNodes: [...this.shapeNodeMap.values()] }
        : {}),
      ...(this.active.meta !== undefined ? { meta: this.active.meta } : {}),
      ...(this.active.networks !== undefined ? { networks: this.active.networks } : {}),
    }
  }
}

/**
 * Walk `root.networks` along `stack` (empty → root).
 * @param root - root document.
 * @param stack - entered network ids.
 */
function resolveDocAtStack(root: GraphDocument, stack: readonly string[]): GraphDocument {
  let doc = root
  for (const id of stack) {
    const next = doc.networks?.[id]
    if (next === undefined) {
      throw new Error(`resolveDocAtStack: missing network ${id}`)
    }
    doc = next
  }
  return doc
}

/**
 * Immutable write of `leaf` at `stack` under `root` (empty stack replaces root body).
 * Preserves existing nested `networks` on the leaf when the patch omitted them.
 * @param root - root document.
 * @param stack - entered network ids.
 * @param leaf - active document after apply.
 */
function writeDocAtStack(
  root: GraphDocument,
  stack: readonly string[],
  leaf: GraphDocument,
): GraphDocument {
  if (stack.length === 0) {
    return {
      ...structuredClone(leaf),
      ...(root.networks !== undefined
        ? { networks: leaf.networks ?? root.networks }
        : leaf.networks !== undefined
          ? { networks: leaf.networks }
          : {}),
    }
  }
  const [head, ...rest] = stack
  if (head === undefined) {
    throw new Error('writeDocAtStack: empty head')
  }
  const networks = { ...(root.networks ?? {}) }
  const existing = networks[head]
  if (existing === undefined) {
    throw new Error(`writeDocAtStack: missing network ${head}`)
  }
  networks[head] = writeDocAtStack(existing, rest, leaf)
  return { ...root, networks }
}

/**
 * Collect scene dirty ids from patch ops against the pre-apply document.
 * @param before - active document before apply.
 * @param ops - validated patch ops.
 */
export function collectPatchDirty(
  before: GraphDocument,
  ops: readonly GraphPatch['ops'][number][],
): { invalidateAll: boolean; ids: ReadonlySet<string> } {
  const ids = new Set<string>()
  let invalidateAll = false
  for (const op of ops) {
    switch (op.op) {
      case 'addNode':
        ids.add(op.node.id)
        break
      case 'updateNode':
        ids.add(op.id)
        for (const edge of before.edges) {
          if (edge.from === op.id || edge.to === op.id) ids.add(edge.id)
        }
        break
      case 'removeNode':
        ids.add(op.id)
        for (const edge of before.edges) {
          if (edge.from === op.id || edge.to === op.id) ids.add(edge.id)
        }
        break
      case 'addEdge':
        ids.add(op.edge.id)
        break
      case 'updateEdge':
      case 'removeEdge':
        ids.add(op.id)
        break
      case 'addGroup':
        ids.add(op.group.id)
        break
      case 'updateGroup':
      case 'removeGroup':
        ids.add(op.id)
        break
      case 'addPath':
        ids.add(op.path.id)
        break
      case 'updatePath':
      case 'removePath':
        ids.add(op.id)
        break
      case 'addShapeNode':
        ids.add(op.shapeNode.id)
        break
      case 'updateShapeNode':
      case 'removeShapeNode':
        ids.add(op.id)
        break
      case 'setAlarms':
        ids.add(op.elementId)
        break
      case 'setViewport':
        invalidateAll = true
        break
      case 'setSelection':
      case 'enterSubNetwork':
      case 'exitSubNetwork':
        break
      default: {
        const _exhaustive: never = op
        throw new Error(`collectPatchDirty: unhandled op ${JSON.stringify(_exhaustive)}`)
      }
    }
  }
  return { invalidateAll, ids }
}

function pushIndex(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list === undefined) map.set(key, [value])
  else list.push(value)
}

function emptyDocument(): GraphDocument {
  return { version: 1, nodes: [], edges: [] }
}

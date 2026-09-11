/**
 * Network: mount, RAF validate loop, protocol API, event fan-out.
 */

import { growRect, unionRect, type Rect } from '../geom.ts'
import { GraphScene } from '../model/scene.ts'
import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import { graphPatchSchema } from '../protocol/schema.ts'
import type { GraphDocument, GraphEdge, GraphGroup, GraphNode, GraphViewport } from '../protocol/types.ts'
import { Canvas2DRenderer } from '../render/canvas2d.ts'
import type { Renderer } from '../render/canvas2d.ts'
import {
  groupBounds,
  hitTestEdges,
  hitTestGroups,
  hitTestNodes,
  nodeBounds,
  ViewSet,
} from '../ui/index.ts'
import {
  PanZoomInteraction,
  SelectActivateInteraction,
  type Interaction,
  type OverlayChrome,
} from '../interaction/index.ts'
import { layoutFlowColumns, layoutGrid } from '../layout/index.ts'
import { DirtyAccumulator } from './dirty.ts'
import { Viewport } from './viewport.ts'

export type GraphEventHandler = (event: GraphEvent) => void

export interface NetworkOptions {
  /** Extra interactions beyond defaults. */
  readonly interactions?: readonly Interaction[]
  /** Attach default pan/zoom + select when true (default true). */
  readonly defaultInteractions?: boolean
  debugPaintRects?: boolean
  /**
   * Build the paint backend after canvases exist.
   * Default: Canvas2DRenderer with the mounted root/overlay canvases.
   */
  readonly createRenderer?: (canvases: {
    readonly root: HTMLCanvasElement
    readonly overlay: HTMLCanvasElement
    readonly debugPaintRects: boolean
  }) => Renderer
}

/**
 * Resolve the paint backend for a mounted Network.
 * @param options - Network options (may supply createRenderer).
 * @param canvases - mounted root/overlay canvases and debug flag.
 */
export function resolveRenderer(
  options: NetworkOptions,
  canvases: {
    readonly root: HTMLCanvasElement
    readonly overlay: HTMLCanvasElement
    readonly debugPaintRects: boolean
  },
): Renderer {
  if (options.createRenderer !== undefined) {
    return options.createRenderer(canvases)
  }
  return new Canvas2DRenderer({
    root: canvases.root,
    overlay: canvases.overlay,
    ...(canvases.debugPaintRects ? { debugPaintRects: true } : {}),
  })
}

/**
 * Host-facing Network: Document/Patch API + Canvas mount.
 */
export class Network {
  readonly scene = new GraphScene()
  readonly viewport = new Viewport()
  private readonly dirty = new DirtyAccumulator()
  private readonly views = new ViewSet()
  private readonly listeners = new Set<GraphEventHandler>()
  private view: HTMLDivElement | null = null
  private rootCanvas: HTMLCanvasElement | null = null
  private renderer: Renderer | null = null
  private rafId = 0
  private needsScenePaint = true
  private needsOverlayPaint = true
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private readonly disposers: Array<() => void> = []
  private readonly options: NetworkOptions
  private interactionModules: Interaction[] = []
  private gestureDragged = false
  /** Transient overlay painters registered by interactions. */
  private readonly overlayChrome: OverlayChrome[] = []
  /**
   * When set, validate paints only these node ids, incident edges, and skips groups.
   * `undefined` paints the full scene.
   */
  private dragPaintFilter: ReadonlySet<string> | undefined

  constructor(options: NetworkOptions = {}) {
    this.options = options
  }

  /**
   * Subscribe to GraphEvents.
   * @param handler - listener.
   * @returns unsubscribe.
   */
  on(handler: GraphEventHandler): () => void {
    this.listeners.add(handler)
    return () => { this.listeners.delete(handler) }
  }

  /**
   * @param input - GraphDocument or unknown JSON.
   */
  load(input: unknown): void {
    this.scene.load(input)
    this.views.rebuild(this.scene)
    this.views.validateDirty(this.scene)
    const cam = this.scene.camera
    this.viewport.setCamera(cam)
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({ type: 'documentChanged', reason: 'load' })
  }

  /** @returns active network document. */
  toJSON(): GraphDocument {
    return this.scene.toJSON()
  }

  /**
   * Apply a GraphPatch atomically.
   * @param patch - patch object with `ops`.
   */
  apply(patch: GraphPatch | unknown): void {
    const parsed = graphPatchSchema.safeParse(patch)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(`GraphPatch parse failed: ${issue?.message ?? 'invalid'}`)
    }
    const nav = parsed.data.ops.find(op => op.op === 'enterSubNetwork' || op.op === 'exitSubNetwork')
    if (nav !== undefined) {
      if (parsed.data.ops.length !== 1) {
        throw new Error('SubNetwork navigation must be the only op in a patch')
      }
      if (nav.op === 'enterSubNetwork') this.enterSubNetwork(nav.id)
      else this.exitSubNetwork()
      return
    }
    const selection = parsed.data.ops.find(op => op.op === 'setSelection')
    this.scene.apply(parsed.data)
    this.syncDirtyFromScene()
    this.scheduleScenePaint()
    if (selection?.op === 'setSelection') {
      this.scene.setSelection(selection.selectedIds)
      this.emit({ type: 'selectionChanged', selectedIds: selection.selectedIds })
    }
    for (const op of parsed.data.ops) {
      if (op.op !== 'setAlarms') continue
      this.emit({
        type: 'alarmChanged',
        elementId: op.elementId,
        alarms: this.scene.alarmsOf(op.elementId),
      })
    }
    this.emit({ type: 'documentChanged', reason: 'apply' })
  }

  /**
   * Run a named layout and emit layoutCompleted.
   * @param name - `grid` | `flow`.
   */
  layout(name: string): void {
    const doc = this.scene.toJSON()
    const positions = name === 'flow'
      ? layoutFlowColumns(doc)
      : name === 'grid'
        ? layoutGrid(doc)
        : (() => { throw new Error(`Unknown layout: ${name}`) })()
    this.scene.writePositions(positions)
    this.views.sync(this.scene)
    for (const id of Object.keys(positions)) {
      this.views.markNodeGeometryDirty(this.scene, id)
    }
    this.views.validateDirty(this.scene)
    for (const id of Object.keys(positions)) {
      const view = this.views.getNode(id)
      if (view?.isActive === true) this.dirty.add(growRect(view.bounds, 4))
    }
    this.scheduleScenePaint()
    this.emit({ type: 'layoutCompleted', name, positions })
  }

  /**
   * @param id - child network id under root `networks`.
   */
  enterSubNetwork(id: string): void {
    this.scene.enterSubNetwork(id)
    this.views.rebuild(this.scene)
    this.views.validateDirty(this.scene)
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: this.scene.currentNetworkId,
      stack: this.scene.networkStack,
    })
  }

  exitSubNetwork(): void {
    this.scene.exitSubNetwork()
    this.views.rebuild(this.scene)
    this.views.validateDirty(this.scene)
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: null,
      stack: [],
    })
  }

  /**
   * Mount into a parent element and start the RAF loop.
   * @param parent - host DOM node.
   */
  mount(parent: HTMLElement): void {
    if (this.view !== null) throw new Error('Network already mounted')
    this.disposed = false
    const view = document.createElement('div')
    view.className = 'aitopo-view'
    view.style.position = 'relative'
    view.style.width = '100%'
    view.style.height = '100%'
    view.style.overflow = 'hidden'
    view.style.touchAction = 'none'
    const root = document.createElement('canvas')
    const overlay = document.createElement('canvas')
    for (const canvas of [root, overlay]) {
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    }
    overlay.style.pointerEvents = 'none'
    view.append(root, overlay)
    parent.appendChild(view)
    this.view = view
    this.rootCanvas = root
    this.renderer = resolveRenderer(this.options, {
      root,
      overlay,
      debugPaintRects: this.options.debugPaintRects === true,
    })
    this.syncSize()
    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize()
      this.dirty.markAll()
      this.scheduleScenePaint()
    })
    this.resizeObserver.observe(view)
    this.attachInteractions()
    const loop = (time: number): void => {
      void time
      if (this.disposed) return
      this.rafId = requestAnimationFrame(loop)
      if (this.needsScenePaint || this.needsOverlayPaint) this.validate()
    }
    this.rafId = requestAnimationFrame(loop)
  }

  /** Tear down DOM, RAF, and interactions. */
  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    for (const dispose of this.disposers.splice(0)) dispose()
    this.view?.remove()
    this.view = null
    this.rootCanvas = null
    this.renderer = null
  }

  /** Root view element (for interactions). */
  getViewElement(): HTMLDivElement | null {
    return this.view
  }

  /** Overlay is non-interactive; events bind to root canvas. */
  getHitElement(): HTMLCanvasElement | null {
    return this.rootCanvas
  }

  setDebugPaintRects(value: boolean): void {
    this.renderer?.setDebugPaintRects?.(value)
    this.dirty.markAll()
    this.scheduleScenePaint()
  }

  /**
   * Select nodes and emit selectionChanged.
   * @param ids - selected ids.
   */
  setSelection(ids: readonly string[]): void {
    this.scene.setSelection(ids)
    this.requestOverlayPaint()
    this.emit({ type: 'selectionChanged', selectedIds: ids })
  }

  /**
   * @param id - hovered node or edge id, or undefined to clear.
   */
  setHover(id: string | undefined): void {
    this.scene.setHover(id)
    this.requestOverlayPaint()
    this.emit({ type: 'hoverChanged', ...(id === undefined ? {} : { hoverId: id }) })
  }

  /**
   * Activate a node (click / dblclick).
   * @param nodeId - target.
   * @param detail - click kind.
   */
  activateNode(nodeId: string, detail: 'click' | 'dblclick'): void {
    this.emit({ type: 'nodeActivated', nodeId, detail })
  }

  /**
   * Update camera and emit viewportChanged.
   * @param mutate - mutates Viewport then syncs.
   */
  updateCamera(mutate: (viewport: Viewport) => void): void {
    mutate(this.viewport)
    const cam = this.viewport.state
    this.scene.setCamera({ x: cam.x, y: cam.y, zoom: cam.zoom })
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({
      type: 'viewportChanged',
      viewport: { x: cam.x, y: cam.y, zoom: cam.zoom } satisfies GraphViewport,
    })
  }

  /** Hit-test at a screen point relative to the hit canvas (nodes first, then edges). */
  hitTestScreen(screenX: number, screenY: number): { id: string; kind: 'node' | 'edge' } | undefined {
    const world = this.viewport.screenToWorld({ x: screenX, y: screenY })
    const zoom = this.viewport.state.zoom
    const nodes = [...this.scene.nodes.values()]
    const nodeHit = hitTestNodes(world, nodes, 2 / zoom)
    if (nodeHit !== undefined) return { id: nodeHit.id, kind: 'node' }
    const edgeHit = hitTestEdges(world, [...this.scene.edges.values()], this.scene.nodes, 4 / zoom)
    return edgeHit === undefined ? undefined : { id: edgeHit.id, kind: 'edge' }
  }

  /**
   * @param id - node id.
   * @returns node from the active network, or undefined.
   */
  getNode(id: string): GraphNode | undefined {
    return this.scene.nodes.get(id)
  }

  /** @returns nodes in the active network. */
  getNodes(): readonly GraphNode[] {
    return [...this.scene.nodes.values()]
  }

  /** @returns groups in the active network. */
  getGroups(): readonly GraphGroup[] {
    return [...this.scene.groups.values()]
  }

  /** @returns edges in the active network. */
  getEdges(): readonly GraphEdge[] {
    return [...this.scene.edges.values()]
  }

  /**
   * Register transient overlay paint; disposer removes it and requests a repaint.
   * @param chrome - painter invoked each validate after scene paint.
   * @returns disposer.
   */
  addOverlayChrome(chrome: OverlayChrome): () => void {
    this.overlayChrome.push(chrome)
    this.requestOverlayPaint()
    return () => {
      const index = this.overlayChrome.indexOf(chrome)
      if (index >= 0) this.overlayChrome.splice(index, 1)
      this.requestOverlayPaint()
    }
  }

  /**
   * Schedule overlay clear + selection/hover/chrome paint.
   * Does not clear or redraw the root canvas.
   */
  requestOverlayPaint(): void {
    this.needsOverlayPaint = true
  }

  /**
   * Alias of {@link Network.requestOverlayPaint}.
   * Prefer `requestOverlayPaint` in new code.
   */
  requestPaint(): void {
    this.requestOverlayPaint()
  }

  /**
   * Restrict paint to mover node ids (+ incident edges). Pass `undefined` for full scene.
   * @param nodeIds - ids to keep visible during drag, or undefined to clear.
   */
  setDragPaintFilter(nodeIds: readonly string[] | undefined): void {
    this.dragPaintFilter = nodeIds === undefined ? undefined : new Set(nodeIds)
    this.dirty.markAll()
    this.scheduleScenePaint()
  }

  /** @returns selected element ids. */
  getSelectedIds(): readonly string[] {
    return [...this.scene.selectedIds]
  }

  /**
   * Hit-test groups at a screen point (smallest area wins; equal area prefers topmost).
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns group id, or undefined.
   */
  hitTestGroupScreen(screenX: number, screenY: number): string | undefined {
    const world = this.screenToWorld(screenX, screenY)
    const hit = hitTestGroups(world, this.getGroups())
    return hit?.id
  }

  /**
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns world point.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.viewport.screenToWorld({ x: screenX, y: screenY })
  }

  /**
   * Live preview position during drag (no nodeMoved / documentChanged).
   * Full-frame invalidate so incident edges and siblings stay painted when
   * `hideOthersWhileDragging` is false (default).
   * @param id - node id.
   * @param x - world x.
   * @param y - world y.
   */
  previewNodePosition(id: string, x: number, y: number): void {
    const node = this.scene.nodes.get(id)
    if (node === undefined) return
    this.scene.writePositions({ [id]: { x, y } })
    this.views.markNodeGeometryDirty(this.scene, id)
    this.dirty.markAll()
    this.scheduleScenePaint()
  }

  /**
   * Live preview bounds during resize (no nodeResized / documentChanged until commit).
   * @param id - node id.
   * @param bounds - world x/y/w/h.
   */
  previewNodeBounds(
    id: string,
    bounds: { x: number; y: number; w: number; h: number },
  ): void {
    if (this.scene.nodes.get(id) === undefined) return
    this.scene.writeBounds({ [id]: bounds })
    this.views.markNodeGeometryDirty(this.scene, id)
    this.dirty.markAll()
    this.scheduleScenePaint()
  }

  /**
   * Commit a node move with optional group membership change.
   * Emits `nodeMoved`; emits `groupMembershipChanged` when membership changes.
   *
   * `toGroupId` sentinel (presence vs value):
   * - property omitted → membership unchanged
   * - `toGroupId: undefined` (key present) → clear membership
   * - `toGroupId: 'g…'` → reparent into that group
   *
   * @param args - from/to positions and optional target group id.
   */
  commitNodeMove(args: {
    nodeId: string
    from: { x: number; y: number }
    to: { x: number; y: number }
    toGroupId?: string | undefined
  }): void {
    const node = this.scene.nodes.get(args.nodeId)
    if (node === undefined) {
      throw new Error(`commitNodeMove: missing node ${args.nodeId}`)
    }
    const fromGroupId = node.groupId
    const membershipRequested = Object.hasOwn(args, 'toGroupId')
    const toGroupId = args.toGroupId
    const membershipChanged = membershipRequested && fromGroupId !== toGroupId

    const ops: GraphPatch['ops'] = [
      { op: 'updateNode', id: args.nodeId, patch: { x: args.to.x, y: args.to.y } },
    ]

    if (membershipChanged) {
      if (fromGroupId !== undefined) {
        const fromGroup = this.scene.groups.get(fromGroupId)
        if (fromGroup !== undefined) {
          ops.push({
            op: 'updateGroup',
            id: fromGroupId,
            patch: { memberIds: fromGroup.memberIds.filter(id => id !== args.nodeId) },
          })
        }
      }
      if (toGroupId !== undefined) {
        const toGroup = this.scene.groups.get(toGroupId)
        if (toGroup === undefined) {
          throw new Error(`commitNodeMove: missing group ${toGroupId}`)
        }
        const memberIds = toGroup.memberIds.includes(args.nodeId)
          ? [...toGroup.memberIds]
          : [...toGroup.memberIds, args.nodeId]
        ops.push({ op: 'updateGroup', id: toGroupId, patch: { memberIds } })
        ops[0] = {
          op: 'updateNode',
          id: args.nodeId,
          patch: { x: args.to.x, y: args.to.y, groupId: toGroupId },
        }
      } else {
        ops[0] = {
          op: 'updateNode',
          id: args.nodeId,
          patch: { x: args.to.x, y: args.to.y, groupId: null },
        }
      }
    }

    this.apply({ ops })
    this.emit({
      type: 'nodeMoved',
      nodeId: args.nodeId,
      from: { x: args.from.x, y: args.from.y },
      to: { x: args.to.x, y: args.to.y },
    })
    if (membershipChanged) {
      this.emit({
        type: 'groupMembershipChanged',
        nodeId: args.nodeId,
        fromGroupId,
        toGroupId,
      })
    }
  }

  /**
   * Commit a node resize.
   * @param args - from/to bounds.
   */
  commitNodeResize(args: {
    nodeId: string
    from: { x: number; y: number; w: number; h: number }
    to: { x: number; y: number; w: number; h: number }
  }): void {
    if (this.scene.nodes.get(args.nodeId) === undefined) {
      throw new Error(`commitNodeResize: missing node ${args.nodeId}`)
    }
    this.apply({
      ops: [{
        op: 'updateNode',
        id: args.nodeId,
        patch: {
          x: args.to.x,
          y: args.to.y,
          w: args.to.w,
          h: args.to.h,
        },
      }],
    })
    this.emit({
      type: 'nodeResized',
      nodeId: args.nodeId,
      from: { ...args.from },
      to: { ...args.to },
    })
  }

  /**
   * Commit a new directed edge. Skips when endpoints missing, identical, or a same-direction edge exists.
   * @param args - endpoints and optional kind / id.
   * @returns created edge id, or undefined when skipped.
   */
  commitEdgeCreate(args: {
    from: string
    to: string
    kind?: string
    id?: string
  }): string | undefined {
    if (args.from === args.to) return undefined
    if (this.scene.nodes.get(args.from) === undefined) return undefined
    if (this.scene.nodes.get(args.to) === undefined) return undefined
    for (const edge of this.scene.edges.values()) {
      if (edge.from === args.from && edge.to === args.to) return undefined
    }
    const edgeId = args.id ?? `e-${args.from}-${args.to}-${Date.now()}`
    if (this.scene.edges.has(edgeId)) return undefined
    this.apply({
      ops: [{
        op: 'addEdge',
        edge: {
          id: edgeId,
          from: args.from,
          to: args.to,
          ...(args.kind !== undefined ? { kind: args.kind } : {}),
        },
      }],
    })
    this.emit({
      type: 'edgeCreated',
      edgeId,
      from: args.from,
      to: args.to,
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
    })
    return edgeId
  }

  /**
   * Remove edges by id; emits `edgeRemoved` for each existing id.
   * @param edgeIds - edge ids to remove.
   */
  commitEdgeRemove(edgeIds: readonly string[]): void {
    const ops: GraphPatch['ops'] = []
    const removed: string[] = []
    for (const id of edgeIds) {
      if (!this.scene.edges.has(id)) continue
      ops.push({ op: 'removeEdge', id })
      removed.push(id)
    }
    if (ops.length === 0) return
    this.apply({ ops })
    for (const edgeId of removed) {
      this.emit({ type: 'edgeRemoved', edgeId })
    }
  }

  /** Mark that a drag consumed this pointer gesture. */
  markGestureDragged(): void {
    this.gestureDragged = true
  }

  /** @returns true when markGestureDragged ran since the last clear. */
  wasGestureDragged(): boolean {
    return this.gestureDragged
  }

  /** Reset the drag-consumed flag. */
  clearGestureDragged(): void {
    this.gestureDragged = false
  }

  /**
   * Fan out a GraphEvent to subscribers.
   * @param event - event payload.
   */
  emit(event: GraphEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  private attachInteractions(): void {
    const defaults = this.options.defaultInteractions === false
      ? []
      : [new PanZoomInteraction(), new SelectActivateInteraction()]
    this.interactionModules = [...defaults, ...(this.options.interactions ?? [])]
    for (const interaction of this.interactionModules) {
      this.disposers.push(interaction.attach(this))
    }
  }

  private syncSize(): void {
    if (this.view === null) return
    const rect = this.view.getBoundingClientRect()
    this.viewport.setViewSize({
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    })
  }

  private syncDirtyFromScene(): void {
    this.views.sync(this.scene)
    const peek = this.scene.takeDirty()
    if (peek.invalidateAll) {
      for (const view of this.views.nodeViews()) view.markDirty()
      for (const view of this.views.edgeViews()) view.markDirty()
      for (const view of this.views.groupViews()) view.markDirty()
      this.dirty.markAll()
      return
    }
    for (const id of peek.ids) {
      if (this.scene.nodes.has(id)) {
        this.views.markNodeGeometryDirty(this.scene, id)
      } else {
        this.views.markDirty(id)
      }
    }
    this.views.validateDirty(this.scene)
    for (const id of peek.ids) {
      const nodeView = this.views.getNode(id)
      if (nodeView?.isActive === true) {
        this.dirty.add(growRect(nodeView.bounds, 8))
        for (const edge of this.scene.edges.values()) {
          if (edge.from !== id && edge.to !== id) continue
          const edgeView = this.views.getEdge(edge.id)
          if (edgeView?.isActive === true) this.dirty.add(growRect(edgeView.bounds, 8))
        }
        continue
      }
      const edgeView = this.views.getEdge(id)
      if (edgeView?.isActive === true) {
        this.dirty.add(growRect(edgeView.bounds, 8))
        continue
      }
      const groupView = this.views.getGroup(id)
      if (groupView?.isActive === true) this.dirty.add(growRect(groupView.bounds, 8))
    }
  }

  /** Schedule root + overlay paint (camera, content, drag filter). */
  private scheduleScenePaint(): void {
    this.needsScenePaint = true
    this.needsOverlayPaint = true
  }

  private edgeHighlightFlags(edge: GraphEdge): { selected: boolean; hovered: boolean } {
    const hoverId = this.scene.hover
    const hoverIsNode = hoverId !== undefined && this.scene.nodes.has(hoverId)
    const relatedData = hoverIsNode
      && edge.kind === 'data'
      && (edge.from === hoverId || edge.to === hoverId)
    return {
      selected: this.scene.selectedIds.has(edge.id),
      hovered: hoverId === edge.id || relatedData,
    }
  }

  private paintOverlayPass(renderer: Renderer): void {
    const hoverId = this.scene.hover
    for (const edge of this.scene.edges.values()) {
      const flags = this.edgeHighlightFlags(edge)
      if (!flags.selected && !flags.hovered) continue
      const view = this.views.getEdge(edge.id)
      if (view === undefined || !view.isActive) continue
      renderer.drawEdge(edge, view.toPaintView(flags.selected, flags.hovered))
    }
    for (const node of this.scene.nodes.values()) {
      const view = this.views.getNode(node.id)
      if (view === undefined || !view.isActive) continue
      const selected = this.scene.selectedIds.has(node.id)
      const hovered = hoverId === node.id
      if (selected) {
        renderer.drawSelectionOverlay(view.bounds)
      } else if (hovered) {
        renderer.drawHoverOverlay(view.bounds)
      }
    }
    for (const chrome of this.overlayChrome) {
      chrome.paint(renderer)
    }
  }

  private validate(): void {
    const renderer: Renderer | null = this.renderer
    if (renderer === null) return
    const paintScene = this.needsScenePaint
    const paintOverlay = this.needsOverlayPaint || paintScene
    this.needsScenePaint = false
    this.needsOverlayPaint = false
    this.views.validateDirty(this.scene)
    const cam = this.viewport.state

    try {
      if (paintScene) {
        const snapshot = this.dirty.take()
        // Filtered drag paint must wipe the whole root layer; partial dirty would leave
        // stale pixels for skipped nodes/groups.
        const dirtyRects: Rect[] | 'all' = this.dragPaintFilter !== undefined || snapshot.invalidateAll
          ? 'all'
          : snapshot.rect === undefined ? 'all' : [snapshot.rect]
        renderer.beginFrame(cam, dirtyRects)
        const filter = this.dragPaintFilter
        if (filter === undefined) {
          for (const group of this.scene.groups.values()) {
            const view = this.views.getGroup(group.id)
            if (view === undefined || !view.isActive) continue
            renderer.drawGroup(group, view.toPaintView())
          }
        }
        for (const edge of this.scene.edges.values()) {
          if (filter !== undefined && !filter.has(edge.from) && !filter.has(edge.to)) continue
          const flags = this.edgeHighlightFlags(edge)
          // Highlighted edges paint only in the overlay pass so root stays free of select/hover.
          if (flags.selected || flags.hovered) continue
          const view = this.views.getEdge(edge.id)
          if (view === undefined || !view.isActive) continue
          renderer.drawEdge(edge, view.toPaintView(false, false))
        }
        for (const node of this.scene.nodes.values()) {
          if (filter !== undefined && !filter.has(node.id)) continue
          const view = this.views.getNode(node.id)
          if (view === undefined || !view.isActive) continue
          renderer.drawNode(node, view.toPaintView(
            this.scene.selectedIds.has(node.id),
            this.scene.hover === node.id,
          ))
        }
      } else if (paintOverlay) {
        // Discard stale scene dirty without painting root (overlay-only frame).
        this.dirty.take()
        renderer.beginFrame(cam, 'overlay')
      } else {
        return
      }
      this.paintOverlayPass(renderer)
      renderer.endFrame()
    } catch {
      // Paint failed: schedule a full-frame retry next tick.
      this.dirty.markAll()
      this.scheduleScenePaint()
    }
  }

}

/** Content union bounds for fit. */
export function contentBounds(scene: GraphScene): Rect | undefined {
  let bounds: Rect | undefined
  for (const node of scene.nodes.values()) {
    bounds = unionRect(bounds, nodeBounds(node))
  }
  for (const group of scene.groups.values()) {
    bounds = unionRect(bounds, groupBounds(group))
  }
  return bounds
}

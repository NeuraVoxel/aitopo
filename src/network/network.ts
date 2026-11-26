/**
 * Network: mount, RAF validate loop, protocol API, event fan-out.
 */

import {
  growRect,
  hitRect,
  intersectsRect,
  unionRect,
  distanceToPolyline,
  type Rect,
} from '../geom.ts'
import { GraphScene } from '../model/scene.ts'
import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import { graphPatchSchema } from '../protocol/schema.ts'
import type {
  GraphDocument,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPath,
  GraphViewport,
} from '../protocol/types.ts'
import { Canvas2DRenderer } from '../render/canvas2d.ts'
import type { Renderer } from '../render/canvas2d.ts'
import {
  groupBounds,
  nodeBounds,
  ViewSet,
} from '../ui/index.ts'
import { computeGroupBandBounds, listDescendantNodeIds } from '../ui/group-state.ts'
import {
  CreateEdgeInteraction,
  DeleteEdgeInteraction,
  MarqueeSelectInteraction,
  MoveEdgeBendInteraction,
  MoveNodeInteraction,
  PanZoomInteraction,
  ResizeNodeInteraction,
  SelectActivateInteraction,
  type HitKind,
  type Interaction,
  type OverlayChrome,
} from '../interaction/index.ts'
import { layoutFlowColumns, layoutGrid } from '../layout/index.ts'
import { DirtyAccumulator } from './dirty.ts'
import { GestureEditor } from './gesture-editor.ts'
import { OverlayChromeRegistry } from './overlay-chrome-registry.ts'
import { elementPaintPad } from './paint-pad.ts'
import { Viewport } from './viewport.ts'

export type GraphEventHandler = (event: GraphEvent) => void

export interface NetworkOptions {
  /** Extra interactions beyond defaults. */
  readonly interactions?: readonly Interaction[]
  /**
   * Attach the default interaction set when true (default true):
   * pan/zoom, click select/activate, node/group move, Shift-marquee select.
   * Ignored after a later `setEditing` call (that replaces the stack).
   */
  readonly defaultInteractions?: boolean
  /**
   * Edge `kind` used by the built-in edit pack's Alt+drag create (`setEditing(true)`).
   * Default `flow`.
   */
  readonly createEdgeKind?: string
  debugPaintRects?: boolean
  /**
   * Host default for node icon visibility when `style.showIcon` is omitted.
   * Default `true`. Per-node `style.showIcon` always wins.
   */
  readonly showNodeIcons?: boolean
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
  private readonly options: NetworkOptions
  private readonly chrome: OverlayChromeRegistry
  private readonly gestures: GestureEditor
  private view: HTMLDivElement | null = null
  private rootCanvas: HTMLCanvasElement | null = null
  private renderer: Renderer | null = null
  private rafId = 0
  private flowPhase = 0
  private needsScenePaint = true
  private needsOverlayPaint = true
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private readonly disposers: Array<() => void> = []
  private interactionModules: Interaction[] = []
  /** Last `setEditing` value; null until the host calls `setEditing`. */
  private editingEnabled: boolean | null = null
  /**
   * Parent cameras pushed on each `enterSubNetwork`, popped on `exitSubNetwork`
   * so exit restores zoom / pan from before that enter (aligned with stack depth).
   */
  private readonly cameraStack: GraphViewport[] = []
  /**
   * Last camera while inside each SubNetwork path (stack ids joined), saved on
   * exit and restored on a later enter of the same path.
   */
  private readonly cameraByPath = new Map<string, GraphViewport>()

  constructor(options: NetworkOptions = {}) {
    this.options = options
    this.views.setShowNodeIconsDefault(options.showNodeIcons !== false)
    this.chrome = new OverlayChromeRegistry(() => {
      this.requestOverlayPaint()
    })
    this.gestures = new GestureEditor({
      scene: this.scene,
      views: this.views,
      dirty: this.dirty,
      scheduleScenePaint: () => {
        this.scheduleScenePaint()
      },
      apply: patch => {
        this.apply(patch)
      },
      emit: event => {
        this.emit(event)
      },
    })
  }

  /**
   * Host default for node icons when `style.showIcon` is omitted.
   * Dirties views and schedules a scene paint.
   * @param value - whether icons are shown by default.
   */
  setShowNodeIcons(value: boolean): void {
    this.views.setShowNodeIconsDefault(value)
    this.scheduleScenePaint()
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
    this.cameraStack.length = 0
    this.cameraByPath.clear()
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
   * Full root `GraphDocument` including nested `networks`, with the active
   * leaf flushed. Use for Copy / Download JSON from hosts.
   */
  toRootJSON(): GraphDocument {
    return this.scene.toRootJSON()
  }

  /**
   * Whether light edit interactions are attached (`setEditing`).
   * `null` before the first `setEditing` call (constructor defaults apply).
   */
  get editing(): boolean | null {
    return this.editingEnabled
  }

  /**
   * Replace the interaction stack with basic or full-edit packs.
   * Basic (`false`, host default): pan/zoom, select/activate, drag-move, Shift-marquee
   * (same as constructor `defaultInteractions`).
   * Edit (`true`): basic + edge bend handles, resize corners, Delete edge, Alt+drag create.
   * Does not remount the canvas (camera/selection stay).
   * @param enabled - true for full edit pack, false for basic drag/pan.
   */
  setEditing(enabled: boolean): void {
    this.editingEnabled = enabled
    this.detachInteractions()
    const basic: Interaction[] = [
      new PanZoomInteraction(),
      new SelectActivateInteraction(),
      new MoveNodeInteraction(),
      new MarqueeSelectInteraction(),
    ]
    const modules: Interaction[] = enabled
      ? [
        new PanZoomInteraction(),
        new SelectActivateInteraction(),
        new MoveEdgeBendInteraction(),
        new ResizeNodeInteraction(),
        new MoveNodeInteraction(),
        new MarqueeSelectInteraction(),
        new DeleteEdgeInteraction(),
        new CreateEdgeInteraction({
          kind: this.options.createEdgeKind ?? 'flow',
          requireAlt: true,
        }),
      ]
      : basic
    this.interactionModules = modules
    for (const interaction of this.interactionModules) {
      this.disposers.push(interaction.attach(this))
    }
    this.requestOverlayPaint()
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
    if (this.dirty.dirty) {
      this.scheduleScenePaint()
    } else {
      this.requestOverlayPaint()
    }
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
   * Enter a child of the current document (`networks[id]`); stack may go deeper than one level.
   * Pushes the current camera so a later {@link exitSubNetwork} can restore zoom / pan.
   * If this stack path was visited before, restores the camera saved on the last exit.
   * @param id - network id under the active document.
   */
  enterSubNetwork(id: string): void {
    const cam = this.viewport.state
    this.cameraStack.push({ x: cam.x, y: cam.y, zoom: cam.zoom })
    this.scene.enterSubNetwork(id)
    this.views.rebuild(this.scene)
    this.views.validateDirty(this.scene)
    const saved = this.cameraByPath.get(networkPathKey(this.scene.networkStack))
    const cameraRestored = saved !== undefined
    if (saved !== undefined) {
      this.viewport.setCamera(saved)
      this.scene.setCamera(saved)
      this.emit({
        type: 'viewportChanged',
        viewport: { x: saved.x, y: saved.y, zoom: saved.zoom },
      })
    } else {
      // First visit: do not keep the parent zoom/pan. Fit when the view has a
      // real size (skip the 1×1 pre-mount default so headless callers stay put).
      // Hosts may still re-fit with their own padding / fitScale after the event.
      const { width, height } = this.viewport.state
      if (width > 1 && height > 1) this.fitContent()
    }
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: this.scene.currentNetworkId,
      stack: this.scene.networkStack,
      direction: 'enter',
      cameraRestored,
    })
  }

  /**
   * Pop one SubNetwork level: save the current (child) camera for a later re-enter,
   * then restore the parent camera from before that enter.
   */
  exitSubNetwork(): void {
    const leavingPath = networkPathKey(this.scene.networkStack)
    const childCam = this.viewport.state
    this.cameraByPath.set(leavingPath, {
      x: childCam.x,
      y: childCam.y,
      zoom: childCam.zoom,
    })
    this.scene.exitSubNetwork()
    this.views.rebuild(this.scene)
    this.views.validateDirty(this.scene)
    const restored = this.cameraStack.pop()
    if (restored !== undefined) {
      this.viewport.setCamera(restored)
      this.scene.setCamera(restored)
      this.emit({
        type: 'viewportChanged',
        viewport: { x: restored.x, y: restored.y, zoom: restored.zoom },
      })
    }
    this.dirty.markAll()
    this.scheduleScenePaint()
    this.emit({
      type: 'subNetworkChanged',
      activeNetworkId: this.scene.currentNetworkId,
      stack: this.scene.networkStack,
      direction: 'exit',
      cameraRestored: false,
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
      if (this.disposed) return
      this.rafId = requestAnimationFrame(loop)
      if (this.views.hasFlowingEdges(this.scene)) {
        this.flowPhase = time
        this.needsScenePaint = true
      }
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
   * Selection glow paints under body fill on the root canvas, so selection
   * changes schedule a scene paint (not overlay-only).
   * @param ids - selected ids.
   */
  setSelection(ids: readonly string[]): void {
    const previous = [...this.scene.selectedIds]
    this.scene.setSelection(ids)
    const touched = new Set([...previous, ...ids])
    for (const id of touched) {
      const nodeView = this.views.getNode(id)
      if (nodeView?.isActive === true) {
        const paint = nodeView.toPaintView(true, false)
        this.dirty.add(growRect(nodeView.bounds, elementPaintPad({
          shadowBlur: paint.shadow?.blur,
          shadowOffsetY: paint.shadow?.offsetY,
          selected: true,
          glow: paint.selectStyle?.glow,
          glowBlur: paint.selectStyle?.glowBlur,
        })))
      }
      const groupView = this.views.getGroup(id)
      if (groupView?.isActive === true) {
        const paint = groupView.toPaintView(true, false)
        this.dirty.add(growRect(groupView.bounds, elementPaintPad({
          shadowBlur: paint.shadow?.blur,
          shadowOffsetY: paint.shadow?.offsetY,
          selected: true,
          glow: paint.selectStyle?.glow,
          glowBlur: paint.selectStyle?.glowBlur,
        })))
      }
      const pathView = this.views.getPath(id)
      if (pathView !== undefined && pathView.points.length >= 2) {
        this.dirty.add(growRect(pathView.bounds, 8))
      }
    }
    this.scheduleScenePaint()
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

  /** Active sub-network id, or null at the root network. */
  get currentNetworkId(): string | null {
    return this.scene.currentNetworkId
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

  /**
   * Union bounds of everything painted in the active network (bodies, bands,
   * paths, and scene attachments like labels), or undefined when empty.
   */
  contentBounds(): Rect | undefined {
    this.views.validateDirty(this.scene)
    let bounds: Rect | undefined
    for (const view of this.views.pathViews()) {
      if (view.points.length < 2) continue
      bounds = unionRect(bounds, view.bounds)
    }
    for (const view of this.views.nodeViews()) {
      if (!view.isActive) continue
      bounds = unionRect(bounds, view.bounds)
    }
    for (const view of this.views.edgeViews()) {
      if (!view.isActive) continue
      bounds = unionRect(bounds, view.bounds)
    }
    for (const view of this.views.groupViews()) {
      if (!view.isActive) continue
      bounds = unionRect(bounds, view.bandBounds)
    }
    return bounds
  }

  /**
   * Zoom and pan so the active network's content fits the viewport.
   * @param padding - CSS pixels kept clear on every side.
   */
  fitContent(padding = 24): void {
    const bounds = this.contentBounds()
    if (bounds === undefined) return
    this.updateCamera(viewport => {
      viewport.fitBounds(bounds, padding)
    })
  }

  /**
   * Hit-test at a screen point relative to the hit canvas.
   * Order matches reverse paint (twaver `getElementAt` top-down):
   * nodes → edges → groups → paths (paths paint lowest / lanes under cars).
   * Edges paint above group bands, so polyline hits must win over band fill.
   * Edge labels / alarms (union attachments) are hittable like twaver link attachments.
   */
  hitTestScreen(screenX: number, screenY: number): { id: string; kind: HitKind } | undefined {
    const world = this.viewport.screenToWorld({ x: screenX, y: screenY })
    const zoom = this.viewport.state.zoom
    this.views.validateDirty(this.scene)
    const nodes = [...this.scene.nodes.values()]
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i]!
      const view = this.views.getNode(node.id)
      if (view === undefined || !view.isVisible) continue
      if (hitRect(world, view.bounds, 2 / zoom)) return { id: node.id, kind: 'node' }
    }
    const pad = 4 / zoom
    let bestId: string | undefined
    let bestDist = pad
    for (const edge of this.scene.edges.values()) {
      const view = this.views.getEdge(edge.id)
      if (view === undefined || !view.isActive) continue
      if (view.hitsAttachment(world)) {
        bestDist = 0
        bestId = edge.id
        continue
      }
      const dist = distanceToPolyline(world, view.points)
      if (dist <= bestDist) {
        bestDist = dist
        bestId = edge.id
      }
    }
    if (bestId !== undefined) return { id: bestId, kind: 'edge' }
    const groups = [...this.scene.groups.values()].sort((a, b) => {
      // Prefer deeper (nested) groups when bands overlap.
      const depth = (id: string): number => {
        let d = 0
        let g = this.scene.groups.get(id)
        while (g?.parentId !== undefined) {
          d += 1
          g = this.scene.groups.get(g.parentId)
        }
        return d
      }
      return depth(b.id) - depth(a.id)
    })
    for (const group of groups) {
      const view = this.views.getGroup(group.id)
      if (view === undefined || !view.isVisible) continue
      if (hitRect(world, view.bandBounds, 2 / zoom)) return { id: group.id, kind: 'group' }
    }
    const paths = [...this.scene.paths.values()]
    for (let i = paths.length - 1; i >= 0; i -= 1) {
      const path = paths[i]!
      const view = this.views.getPath(path.id)
      if (view === undefined || view.points.length < 2) continue
      if (view.hit(world.x, world.y, pad)) return { id: path.id, kind: 'path' }
    }
    return undefined
  }

  /**
   * @param id - node id.
   * @returns node from the active network, or undefined.
   */
  getNode(id: string): GraphNode | undefined {
    return this.scene.nodes.get(id)
  }

  /** @param id - group id. @returns group from the active network, or undefined. */
  getGroup(id: string): GraphGroup | undefined {
    return this.scene.groups.get(id)
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

  /** @returns freestanding paths in the active network. */
  getPaths(): readonly GraphPath[] {
    return [...this.scene.paths.values()]
  }

  /**
   * Register transient overlay paint; disposer removes it and requests a repaint.
   * @param chrome - painter invoked each validate after scene paint.
   * @returns disposer.
   */
  addOverlayChrome(chrome: OverlayChrome): () => void {
    return this.chrome.add(chrome)
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
    this.gestures.setDragPaintFilter(nodeIds)
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
    this.views.validateDirty(this.scene)
    let bestId: string | undefined
    let bestArea = Infinity
    const groups = [...this.scene.groups.values()]
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const group = groups[i]!
      const view = this.views.getGroup(group.id)
      if (view === undefined || !view.isVisible) continue
      if (!hitRect(world, view.bandBounds)) continue
      const area = view.bandBounds.width * view.bandBounds.height
      if (bestId === undefined || area < bestArea) {
        bestId = group.id
        bestArea = area
      }
    }
    return bestId
  }

  /**
   * Validated band / collapsed-body bounds of a group (auto-fit aware).
   * @param id - group id.
   * @returns world rect, or undefined when the group is inactive.
   */
  getGroupBandBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
    this.views.validateDirty(this.scene)
    const view = this.views.getGroup(id)
    if (view === undefined || !view.isActive) return undefined
    return view.bandBounds
  }

  /**
   * Validated edge path AABB for marquee selection.
   * @param id - edge id.
   * @returns world rect, or undefined when the edge is inactive.
   */
  getEdgePathBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
    this.views.validateDirty(this.scene)
    const view = this.views.getEdge(id)
    if (view === undefined || !view.isActive) return undefined
    return view.pathBounds
  }

  /**
   * Validated freestanding path AABB for marquee / dirty-rect.
   * @param id - path id.
   * @returns world rect, or undefined when missing / empty.
   */
  getPathBounds(id: string): { x: number; y: number; width: number; height: number } | undefined {
    this.views.validateDirty(this.scene)
    const view = this.views.getPath(id)
    if (view === undefined || view.points.length < 2) return undefined
    return view.bounds
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
   * Unions old and new node/edge bounds into the dirty accumulator (not full-frame)
   * unless a drag paint filter is active.
   * @param id - node id.
   * @param x - world x.
   * @param y - world y.
   */
  previewNodePosition(id: string, x: number, y: number): void {
    this.gestures.previewNodePosition(id, x, y)
  }

  /**
   * Live preview of a group drag (group origin + member nodes).
   * @param args - deltas and drag-start origins.
   */
  previewGroupMove(args: {
    groupId: string
    dx: number
    dy: number
    groupFrom: { x: number; y: number }
    members: readonly { id: string; fromX: number; fromY: number }[]
    childGroups?: readonly { id: string; fromX: number; fromY: number }[]
  }): void {
    this.gestures.previewGroupMove(args)
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
    this.gestures.previewNodeBounds(id, bounds)
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
    this.gestures.commitNodeMove(args)
  }

  /**
   * Commit a group drag: updateGroup x/y and member node positions.
   * @param args - group and member from/to.
   */
  commitGroupMove(args: {
    groupId: string
    groupFrom: { x: number; y: number }
    groupTo: { x: number; y: number }
    members: readonly {
      id: string
      from: { x: number; y: number }
      to: { x: number; y: number }
    }[]
    childGroups?: readonly {
      id: string
      from: { x: number; y: number }
      to: { x: number; y: number }
    }[]
  }): void {
    this.gestures.commitGroupMove(args)
  }

  /**
   * Toggle group expand/collapse (double-click path).
   * @param groupId - group id.
   */
  toggleGroupExpanded(groupId: string): void {
    this.gestures.toggleGroupExpanded(groupId)
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
    this.gestures.commitNodeResize(args)
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
    return this.gestures.commitEdgeCreate(args)
  }

  /**
   * Remove edges by id; emits `edgeRemoved` for each existing id.
   * @param edgeIds - edge ids to remove.
   */
  commitEdgeRemove(edgeIds: readonly string[]): void {
    this.gestures.commitEdgeRemove(edgeIds)
  }

  /**
   * Live preview of edge bend waypoints.
   * @param edgeId - edge id.
   * @param waypoints - intermediate points.
   */
  previewEdgeWaypoints(
    edgeId: string,
    waypoints: readonly { readonly x: number; readonly y: number }[],
  ): void {
    this.gestures.previewEdgeWaypoints(edgeId, waypoints)
  }

  /**
   * Commit edge bend waypoints; emits `edgeWaypointsChanged`.
   * @param args - edge id and from/to waypoint lists.
   */
  commitEdgeWaypoints(args: {
    edgeId: string
    from: readonly { readonly x: number; readonly y: number }[]
    to: readonly { readonly x: number; readonly y: number }[]
  }): void {
    this.gestures.commitEdgeWaypoints(args)
  }

  /**
   * Commit a new freestanding path. Skips when fewer than two points or id collision.
   * @param args - control points and optional style / id / closed.
   * @returns created path id, or undefined when skipped.
   */
  commitPathCreate(args: {
    points: readonly { readonly x: number; readonly y: number }[]
    closed?: boolean
    style?: GraphPath['style']
    label?: string
    id?: string
  }): string | undefined {
    return this.gestures.commitPathCreate(args)
  }

  /**
   * Commit a path update; emits `pathUpdated`.
   * @param args - path id and patch fragment.
   */
  commitPathUpdate(args: {
    pathId: string
    patch: {
      points?: readonly { readonly x: number; readonly y: number }[]
      closed?: boolean
      label?: string
      locked?: boolean
      style?: GraphPath['style']
    }
  }): void {
    this.gestures.commitPathUpdate(args)
  }

  /**
   * Remove paths by id; emits `pathRemoved` for each existing id.
   * @param pathIds - path ids to remove.
   */
  commitPathRemove(pathIds: readonly string[]): void {
    this.gestures.commitPathRemove(pathIds)
  }

  /** Mark that a drag consumed this pointer gesture. */
  markGestureDragged(): void {
    this.gestures.markGestureDragged()
  }

  /** @returns true when markGestureDragged ran since the last clear. */
  wasGestureDragged(): boolean {
    return this.gestures.wasGestureDragged()
  }

  /** Reset the drag-consumed flag. */
  clearGestureDragged(): void {
    this.gestures.clearGestureDragged()
  }

  /**
   * Fan out a GraphEvent to subscribers.
   * @param event - event payload.
   */
  emit(event: GraphEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  private detachInteractions(): void {
    for (const dispose of this.disposers.splice(0)) dispose()
    this.interactionModules = []
  }

  private attachInteractions(): void {
    if (this.editingEnabled !== null) {
      this.setEditing(this.editingEnabled)
      return
    }
    const defaults = this.options.defaultInteractions === false
      ? []
      : [
        new PanZoomInteraction(),
        new SelectActivateInteraction(),
        new MoveNodeInteraction(),
        new MarqueeSelectInteraction(),
      ]
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
    const peek = this.scene.takeDirty()
    if (peek.invalidateAll) {
      this.views.sync(this.scene)
      for (const view of this.views.nodeViews()) view.markDirty()
      for (const view of this.views.edgeViews()) view.markDirty()
      for (const view of this.views.groupViews()) view.markDirty()
      for (const view of this.views.pathViews()) view.markDirty()
      this.dirty.markAll()
      return
    }
    // Capture old geometry before membership sync drops removed Views.
    // Group expand/collapse remaps agent edges; capture those paths even when
    // collectPatchDirty only listed the group id (no memberMoves).
    const oldRects: Rect[] = []
    for (const id of peek.ids) {
      const nodeView = this.views.getNode(id)
      if (nodeView?.isActive === true) {
        oldRects.push(growRect(nodeView.bounds, this.nodePaintPad(id)))
        this.pushIncidentEdgeAndEndpointRects(oldRects, id)
      }
      const edgeView = this.views.getEdge(id)
      if (edgeView?.isActive === true) {
        oldRects.push(growRect(edgeView.bounds, 8))
        this.pushEdgeEndpointRects(oldRects, id)
      }
      const pathView = this.views.getPath(id)
      if (pathView !== undefined && pathView.points.length >= 2) {
        oldRects.push(growRect(pathView.bounds, 8))
      }
      if (this.scene.groups.has(id)) {
        for (const rect of this.captureGroupTopologyRects(id)) oldRects.push(rect)
      } else {
        const groupView = this.views.getGroup(id)
        if (groupView?.isActive === true) oldRects.push(growRect(groupView.bounds, 8))
      }
    }
    this.views.sync(this.scene)
    for (const id of peek.ids) {
      if (this.scene.nodes.has(id)) {
        this.views.markNodeGeometryDirty(this.scene, id)
      } else if (this.scene.groups.has(id)) {
        this.views.markGroupGeometryDirty(this.scene, id)
      } else {
        this.views.markDirty(id)
      }
    }
    this.views.validateDirty(this.scene)
    for (const rect of oldRects) this.dirty.add(rect)
    for (const id of peek.ids) {
      const nodeView = this.views.getNode(id)
      if (nodeView?.isActive === true) {
        this.dirty.add(growRect(nodeView.bounds, this.nodePaintPad(id)))
        this.pushIncidentEdgeAndEndpointRects(undefined, id)
        continue
      }
      const edgeView = this.views.getEdge(id)
      if (edgeView?.isActive === true) {
        this.dirty.add(growRect(edgeView.bounds, 8))
        this.pushEdgeEndpointRects(undefined, id)
        continue
      }
      const pathView = this.views.getPath(id)
      if (pathView !== undefined && pathView.points.length >= 2) {
        this.dirty.add(growRect(pathView.bounds, 8))
        continue
      }
      if (this.scene.groups.has(id)) {
        for (const rect of this.captureGroupTopologyRects(id)) this.dirty.add(rect)
        continue
      }
      const groupView = this.views.getGroup(id)
      if (groupView?.isActive === true) this.dirty.add(growRect(groupView.bounds, 8))
    }
  }

  /** Grow pad covering drop shadow and selection glow for a node id. */
  private nodePaintPad(nodeId: string): number {
    const selected = this.scene.selectedIds.has(nodeId)
    const paint = this.views.getNode(nodeId)?.toPaintView(selected, false)
    return elementPaintPad({
      shadowBlur: paint?.shadow?.blur,
      shadowOffsetY: paint?.shadow?.offsetY,
      selected,
      glow: paint?.selectStyle?.glow,
      glowBlur: paint?.selectStyle?.glowBlur,
    })
  }

  /**
   * Incident edges plus far endpoints (full body). Edge AABB alone often clips
   * only a strip of the far node and leaves shadow/AA residuals.
   */
  private pushIncidentEdgeAndEndpointRects(
    into: Rect[] | undefined,
    nodeId: string,
  ): void {
    for (const edge of this.scene.edges.values()) {
      if (edge.from !== nodeId && edge.to !== nodeId) continue
      const edgeView = this.views.getEdge(edge.id)
      if (edgeView?.isActive === true) {
        this.pushPaintRect(into, growRect(edgeView.bounds, 8))
      }
      this.pushEndpointPaintRect(into, edge.from === nodeId ? edge.to : edge.from)
    }
  }

  private pushEdgeEndpointRects(into: Rect[] | undefined, edgeId: string): void {
    const edge = this.scene.edges.get(edgeId)
    if (edge === undefined) return
    this.pushEndpointPaintRect(into, edge.from)
    this.pushEndpointPaintRect(into, edge.to)
  }

  private pushEndpointPaintRect(into: Rect[] | undefined, endpointId: string): void {
    const nodeView = this.views.getNode(endpointId)
    if (nodeView?.isActive === true) {
      this.pushPaintRect(into, growRect(nodeView.bounds, this.nodePaintPad(endpointId)))
      return
    }
    const groupView = this.views.getGroup(endpointId)
    if (groupView?.isActive !== true) return
    const selected = this.scene.selectedIds.has(endpointId)
    const paint = groupView.toPaintView(selected, false)
    this.pushPaintRect(into, growRect(groupView.bounds, elementPaintPad({
      shadowBlur: paint.shadow?.blur,
      shadowOffsetY: paint.shadow?.offsetY,
      selected,
      glow: paint.selectStyle?.glow,
      glowBlur: paint.selectStyle?.glowBlur,
    })))
  }

  private pushPaintRect(into: Rect[] | undefined, rect: Rect): void {
    if (into !== undefined) into.push(rect)
    else this.dirty.add(rect)
  }

  /**
   * Group band + visible members + incident edges (agent-remap topology).
   * Used so expand/collapse paints clear old cross-edge paths outside the band.
   */
  private captureGroupTopologyRects(groupId: string): Rect[] {
    const rects: Rect[] = []
    const groupView = this.views.getGroup(groupId)
    if (groupView?.isActive === true) rects.push(growRect(groupView.bounds, 8))
    const group = this.scene.groups.get(groupId)
    if (group === undefined) return rects
    const members = new Set(listDescendantNodeIds(this.scene, group))
    for (const memberId of members) {
      const nodeView = this.views.getNode(memberId)
      if (nodeView?.isActive === true) rects.push(growRect(nodeView.bounds, 8))
    }
    for (const edge of this.scene.edges.values()) {
      if (!members.has(edge.from) && !members.has(edge.to)) continue
      const edgeView = this.views.getEdge(edge.id)
      if (edgeView?.isActive === true) rects.push(growRect(edgeView.bounds, 8))
    }
    return rects
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
    const handleSize = 10 / this.viewport.state.zoom
    for (const path of this.scene.paths.values()) {
      const view = this.views.getPath(path.id)
      if (view === undefined || view.points.length < 2) continue
      const selected = this.scene.selectedIds.has(path.id)
      const hovered = hoverId === path.id
      if (selected || hovered) {
        renderer.drawPath(path, view.toPaintView(selected, hovered))
      }
      if (selected) {
        for (const point of path.points) {
          renderer.drawResizeHandle(point, handleSize)
        }
      }
    }
    for (const edge of this.scene.edges.values()) {
      const flags = this.edgeHighlightFlags(edge)
      if (!flags.selected && !flags.hovered) continue
      const view = this.views.getEdge(edge.id)
      if (view === undefined || !view.isActive) continue
      const paint = view.toPaintView(flags.selected, flags.hovered)
      renderer.drawEdge(edge, paint)
      if (paint.overlayAttachments.length > 0) {
        renderer.drawOverlayAttachments?.(paint.overlayAttachments, paint.alpha)
      }
    }
    for (const group of this.scene.groups.values()) {
      const view = this.views.getGroup(group.id)
      if (view === undefined || !view.isVisible) continue
      const selected = this.scene.selectedIds.has(group.id)
      const hovered = hoverId === group.id
      const paint = view.toPaintView(selected, hovered)
      if (selected) {
        renderer.drawSelectionOverlay(view.bandBounds, paint.selectStyle, paint.alpha)
      } else if (hovered) {
        renderer.drawHoverOverlay(view.bandBounds, paint.hoverStyle, paint.alpha)
      }
      if (paint.overlayAttachments.length > 0) {
        renderer.drawOverlayAttachments?.(paint.overlayAttachments, paint.alpha)
      }
    }
    for (const node of this.scene.nodes.values()) {
      const view = this.views.getNode(node.id)
      if (view === undefined || !view.isVisible) continue
      const selected = this.scene.selectedIds.has(node.id)
      const hovered = hoverId === node.id
      const paint = view.toPaintView(selected, hovered)
      if (selected) {
        renderer.drawSelectionOverlay(view.bodyBounds, paint.selectStyle, paint.alpha)
      } else if (hovered) {
        renderer.drawHoverOverlay(view.bodyBounds, paint.hoverStyle, paint.alpha)
      }
      if (paint.overlayAttachments.length > 0) {
        renderer.drawOverlayAttachments?.(paint.overlayAttachments, paint.alpha)
      }
    }
    this.chrome.paintAll(renderer)
  }

  private validate(): void {
    const renderer: Renderer | null = this.renderer
    if (renderer === null) return
    const paintScene = this.needsScenePaint
    const paintOverlay = this.needsOverlayPaint || paintScene
    this.needsScenePaint = false
    this.needsOverlayPaint = false
    this.views.validateDirty(this.scene, { flowPhase: this.flowPhase })
    const cam = this.viewport.state

    try {
      if (paintScene) {
        const snapshot = this.dirty.take()
        // Filtered drag paint must wipe the whole root layer; partial dirty would leave
        // stale pixels for skipped nodes/groups.
        const filter = this.gestures.dragPaintFilter
        const dirtyRects: Rect[] | 'all' = filter !== undefined || snapshot.invalidateAll
          ? 'all'
          : snapshot.rect === undefined ? 'all' : [snapshot.rect]
        // Partial dirty: skip draw calls whose bounds miss the cleared hole.
        // (Canvas clip alone still paid O(n) CPU; selection glow relies on this cull.)
        const cullRects = dirtyRects === 'all' ? undefined : dirtyRects
        const inDirty = (bounds: Rect): boolean => {
          if (cullRects === undefined) return true
          for (const rect of cullRects) {
            if (intersectsRect(bounds, rect)) return true
          }
          return false
        }
        renderer.beginFrame(cam, dirtyRects)
        // Paths paint under groups/edges/nodes (lanes under cars).
        if (filter === undefined) {
          for (const path of this.scene.paths.values()) {
            const view = this.views.getPath(path.id)
            if (view === undefined || view.points.length < 2) continue
            if (!inDirty(view.bounds)) continue
            renderer.drawPath(path, view.toPaintView(false, false))
          }
          for (const group of this.scene.groups.values()) {
            const view = this.views.getGroup(group.id)
            if (view === undefined || !view.isVisible) continue
            if (!inDirty(view.bounds)) continue
            const selected = this.scene.selectedIds.has(group.id)
            const hovered = this.scene.hover === group.id
            renderer.drawGroup(group, view.toPaintView(selected, hovered))
          }
        }
        for (const edge of this.scene.edges.values()) {
          if (filter !== undefined && !filter.has(edge.from) && !filter.has(edge.to)) continue
          const view = this.views.getEdge(edge.id)
          if (view === undefined || !view.isActive) continue
          if (!inDirty(view.bounds)) continue
          // Base paint always lands on the root layer; select/hover styling is
          // stacked on top by the overlay pass. Skipping highlighted edges here
          // would leave root holes that unhover (overlay-only) never refills.
          renderer.drawEdge(edge, view.toPaintView(false, false))
        }
        for (const node of this.scene.nodes.values()) {
          if (filter !== undefined && !filter.has(node.id)) continue
          const view = this.views.getNode(node.id)
          if (view === undefined || !view.isVisible) continue
          if (!inDirty(view.bounds)) continue
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
  for (const path of scene.paths.values()) {
    if (path.points.length < 2) continue
    let box: Rect | undefined
    for (const p of path.points) {
      const pad = 4
      const r = { x: p.x - pad, y: p.y - pad, width: pad * 2, height: pad * 2 }
      box = unionRect(box, r)
    }
    if (box !== undefined) bounds = unionRect(bounds, box)
  }
  for (const node of scene.nodes.values()) {
    bounds = unionRect(bounds, nodeBounds(node))
  }
  for (const group of scene.groups.values()) {
    // Expanded auto-fit bands follow member positions, not the declared x/y/w/h.
    bounds = unionRect(bounds, group.expanded === true
      ? computeGroupBandBounds(scene, group)
      : groupBounds(group))
  }
  return bounds
}

/** Stable key for a SubNetwork stack path (enter/exit camera memory). */
function networkPathKey(stack: readonly string[]): string {
  return stack.join('\0')
}

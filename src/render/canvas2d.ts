/**
 * Renderer abstraction and Canvas 2D implementation.
 */

import { anglePivot, rotateCanvasAbout, type Point, type Rect } from '../geom.ts'
import type {
  GraphAngleAnchor,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPath,
  GraphShapeNode,
} from '../protocol/types.ts'
import { getIcon } from '../ui/attachment/icon-registry.ts'
import type { AttachmentPaintOp } from '../ui/attachment/types.ts'

/** Camera state passed into a frame. */
export interface ViewportState {
  readonly x: number
  readonly y: number
  readonly zoom: number
  readonly width: number
  readonly height: number
}

/** Cached geometry for a node paint. */
export interface NodePaintView {
  /** Union bounds (compat / dirty). */
  readonly bounds: Rect
  readonly bodyBounds: Rect
  readonly unionBounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
  /** Rotation degrees (normalized); omitted ≡ 0. `bodyBounds` stay unrotated. */
  readonly angle?: number
  /** Relative pivot inside `bodyBounds`; omitted ≡ center. */
  readonly angleAnchor?: GraphAngleAnchor
  /** Circle body (tool / data.shape). */
  readonly circular: boolean
  /** Whole-node opacity `[0, 1]`; default `1`. */
  readonly alpha: number
  readonly shadow?: {
    readonly color?: string
    readonly blur?: number
    readonly offsetX?: number
    readonly offsetY?: number
  }
  readonly selectStyle?: {
    readonly color?: string
    readonly width?: number
    readonly padding?: number
    /** Soft under-body glow; default on when selected. */
    readonly glow?: boolean
    readonly glowBlur?: number
  }
  readonly hoverStyle?: {
    readonly color?: string
    readonly width?: number
    readonly padding?: number
    /** Soft overlay glow; default off on hover. */
    readonly glow?: boolean
    readonly glowBlur?: number
  }
  /** Body outline dash pattern; omitted → solid. */
  readonly strokeDash?: readonly number[]
  /** Scene-layer attachment paint ops. */
  readonly attachments: readonly AttachmentPaintOp[]
  /** Overlay-layer attachment paint ops (e.g. hover tooltip). */
  readonly overlayAttachments: readonly AttachmentPaintOp[]
}

/** True canvas arc stroke (ring layouts); densified `points` still used for hit/labels. */
export interface EdgeArcPaint {
  readonly center: { readonly x: number; readonly y: number }
  readonly radius: number
  readonly startAngle: number
  readonly endAngle: number
  readonly clockwise: boolean
}

/** Cached geometry for an edge paint. */
export interface EdgePaintView {
  readonly from: { x: number; y: number }
  readonly to: { x: number; y: number }
  readonly pathBounds: Rect
  readonly unionBounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
  /** Prefer horizontal vs vertical control points for the bezier. */
  readonly orientation?: 'horizontal' | 'vertical'
  /** Orthogonal polyline (includes endpoints); drawn with rounded elbows. */
  readonly points?: readonly { x: number; y: number }[]
  /** When set, stroke uses `ctx.arc` instead of rounded polyline. */
  readonly arc?: EdgeArcPaint
  /** Whole-edge opacity `[0, 1]`; default `1`. */
  readonly alpha: number
  readonly stroke: string
  readonly lineWidth: number
  readonly strokeDash?: readonly number[]
  /** Animated dash offset (flow). */
  readonly flowDashOffset?: number
  /** Corner join. Omitted → `round`. */
  readonly corner?: 'none' | 'round' | 'bevel'
  /** Corner radius / bevel inset. Omitted → `8`. */
  readonly cornerRadius?: number
  readonly arrowFrom?: EdgeArrowPaint
  readonly arrowTo?: EdgeArrowPaint
  readonly attachments: readonly AttachmentPaintOp[]
  readonly overlayAttachments: readonly AttachmentPaintOp[]
}

/** Resolved arrow head for one edge end. */
export interface EdgeArrowPaint {
  readonly tip: { readonly x: number; readonly y: number }
  /** Unit direction the arrow points toward (away from the path interior). */
  readonly direction: { readonly x: number; readonly y: number }
  readonly size: number
  readonly fill: string
  readonly stroke: string
  /** Omitted → `standard`. */
  readonly shape?: 'standard' | 'delta' | 'diamond' | 'short' | 'slant'
}

/** Label paint for a freestanding path (midpoint above stroke). */
export interface PathLabelPaint {
  readonly text: string
  /** World center x. */
  readonly x: number
  /** World center y. */
  readonly y: number
  readonly color: string
  readonly fontSize: number
  readonly fontWeight?: 'normal' | 'bold'
}

/** Cached geometry for a freestanding path paint. */
export interface PathPaintView {
  readonly points: readonly { x: number; y: number }[]
  /** Rotated AABB when `angle` ≠ 0 (dirty / cull); `points` stay unrotated. */
  readonly bounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
  /** Rotation degrees (normalized); omitted ≡ 0. */
  readonly angle?: number
  /** Relative pivot inside the original points AABB; omitted ≡ center. */
  readonly angleAnchor?: GraphAngleAnchor
  /** Resolved world pivot (from the original points AABB); set whenever `angle` ≠ 0. */
  readonly anglePivot?: Point
  readonly closed: boolean
  readonly alpha: number
  readonly stroke: string
  readonly fill?: string
  readonly lineWidth: number
  readonly strokeDash?: readonly number[]
  /** Midpoint-above label; omitted when no label text. */
  readonly label?: PathLabelPaint
  readonly selectStyle?: NodePaintView['selectStyle']
  readonly hoverStyle?: NodePaintView['hoverStyle']
}

/** Cached geometry for a group band. */
export interface GroupPaintView {
  readonly bounds: Rect
  readonly bandBounds: Rect
  readonly unionBounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
  /** Rotation degrees (normalized); omitted ≡ 0. `bandBounds` stay unrotated. */
  readonly angle?: number
  /** Relative pivot inside `bandBounds`; omitted ≡ center. */
  readonly angleAnchor?: GraphAngleAnchor
  readonly expanded: boolean
  readonly alpha: number
  readonly stroke: string
  readonly fill: string
  readonly strokeWidth: number
  readonly strokeDash?: readonly number[]
  readonly shadow?: NodePaintView['shadow']
  readonly selectStyle?: NodePaintView['selectStyle']
  readonly hoverStyle?: NodePaintView['hoverStyle']
  readonly attachments: readonly AttachmentPaintOp[]
  readonly overlayAttachments: readonly AttachmentPaintOp[]
}

/** Rotate a chrome ring about `pivot` (original `bounds` stay unrotated). */
export interface OverlayRotation {
  readonly angle: number
  readonly pivot: Point
}

/**
 * Dirty region for {@link Renderer.beginFrame}.
 * `'overlay'` clears/transforms the overlay only; root pixels stay untouched.
 */
export type FrameDirty = readonly Rect[] | 'all' | 'overlay'

/**
 * Pluggable paint backend (Canvas2D now; WebGL later).
 */
export interface Renderer {
  beginFrame(viewport: ViewportState, dirty: FrameDirty): void
  drawGroup(group: GraphGroup, view: GroupPaintView): void
  drawEdge(edge: GraphEdge, view: EdgePaintView): void
  /** Freestanding path stroke (+ optional closed fill). */
  drawPath(path: GraphPath, view: PathPaintView): void
  /**
   * Shape-node stroke (+ optional closed fill).
   * Reuses {@link PathPaintView} DTO (same densify/paint fields as Path).
   */
  drawShapeNode(shapeNode: GraphShapeNode, view: PathPaintView): void
  drawNode(node: GraphNode, view: NodePaintView): void
  endFrame(): void
  /** Overlay: solid selection ring (no-op OK for headless fakes). Body glow paints under fill on root. */
  drawSelectionOverlay(
    bounds: Rect,
    style?: NodePaintView['selectStyle'],
    alpha?: number,
    rotation?: OverlayRotation,
  ): void
  /** Overlay: hover dashed ring; optional glow (no-op OK for fakes). */
  drawHoverOverlay(
    bounds: Rect,
    style?: NodePaintView['hoverStyle'],
    alpha?: number,
    rotation?: OverlayRotation,
  ): void
  /** Overlay attachment ops (hover tooltip). */
  drawOverlayAttachments?(ops: readonly AttachmentPaintOp[], alpha?: number): void
  /** Overlay: marquee rubber band. */
  drawMarquee(rect: Rect): void
  /** Overlay: edge-create rubber band. */
  drawEdgeRubberBand(from: Point, to: Point): void
  /** Overlay: ghost outline while lazy-moving a node. */
  drawLazyMoveGhost(bounds: Rect): void
  /** Overlay: resize handle square at a corner. */
  drawResizeHandle(center: Point, size: number): void
  /** Overlay: edge bend waypoint handle. */
  drawEdgeBendHandle(center: Point, size: number): void
  /** Optional debug stroke of dirty unions. */
  setDebugPaintRects?(value: boolean): void
}

export interface Canvas2DRendererOptions {
  readonly root: HTMLCanvasElement
  readonly overlay: HTMLCanvasElement
  /** Stroke dirty unions when true. */
  debugPaintRects?: boolean
}

/**
 * Canvas 2D renderer with optional dirty-rect clipping on the root layer.
 */
export class Canvas2DRenderer implements Renderer {
  private readonly root: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement
  private readonly rootCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D
  private debugPaintRects: boolean
  private viewport: ViewportState = { x: 0, y: 0, zoom: 1, width: 1, height: 1 }
  private dirtyMode: FrameDirty = 'all'
  /** True when beginFrame opened a root ctx.save() that endFrame must restore. */
  private rootFrameOpen = false

  constructor(options: Canvas2DRendererOptions) {
    this.root = options.root
    this.overlay = options.overlay
    const rootCtx = options.root.getContext('2d')
    const overlayCtx = options.overlay.getContext('2d')
    if (rootCtx === null || overlayCtx === null) {
      throw new Error('Canvas2DRenderer: 2d context unavailable')
    }
    this.rootCtx = rootCtx
    this.overlayCtx = overlayCtx
    this.debugPaintRects = options.debugPaintRects === true
  }

  setDebugPaintRects(value: boolean): void {
    this.debugPaintRects = value
  }

  beginFrame(viewport: ViewportState, dirty: FrameDirty): void {
    this.viewport = viewport
    this.dirtyMode = dirty
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
    resizeCanvas(this.overlay, viewport.width, viewport.height, dpr)
    this.beginOverlayTransform(viewport, dpr)
    if (dirty === 'overlay') {
      this.rootFrameOpen = false
      return
    }
    resizeCanvas(this.root, viewport.width, viewport.height, dpr)
    const ctx = this.rootCtx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Partial dirty must clear only those screen rects. Clearing the full canvas then
    // clipping would erase every element outside the dirty union (looks like hide-others).
    if (dirty === 'all' || dirty.length === 0) {
      ctx.clearRect(0, 0, viewport.width, viewport.height)
    } else {
      for (const rect of dirty) {
        const sx = (rect.x - viewport.x) * viewport.zoom
        const sy = (rect.y - viewport.y) * viewport.zoom
        const sw = rect.width * viewport.zoom
        const sh = rect.height * viewport.zoom
        ctx.clearRect(sx, sy, sw, sh)
      }
    }
    ctx.save()
    this.rootFrameOpen = true
    ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    ctx.scale(viewport.zoom, viewport.zoom)
    if (dirty !== 'all' && dirty.length > 0) {
      ctx.beginPath()
      for (const rect of dirty) {
        ctx.rect(rect.x, rect.y, rect.width, rect.height)
      }
      ctx.clip()
    }
  }

  private beginOverlayTransform(viewport: ViewportState, dpr: number): void {
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.overlayCtx.clearRect(0, 0, viewport.width, viewport.height)
    this.overlayCtx.save()
    this.overlayCtx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom)
    this.overlayCtx.scale(viewport.zoom, viewport.zoom)
  }

  drawGroup(group: GraphGroup, view: GroupPaintView): void {
    void group
    const { bandBounds: bounds } = view
    const ctx = this.rootCtx
    ctx.save()
    ctx.globalAlpha = view.alpha
    rotateCanvasAbout(ctx, anglePivot(bounds, view.angleAnchor), view.angle ?? 0)
    applyBodyOuterShadow(ctx, view)
    const strokeWidth = view.strokeWidth / this.viewport.zoom
    // Collapsed: node-like radius 8; expanded band: larger corner radius.
    const radius = view.expanded ? 12 : 8
    roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
    ctx.fillStyle = view.fill
    ctx.fill()
    clearBodyOuterShadow(ctx)
    ctx.strokeStyle = view.stroke
    ctx.lineWidth = strokeWidth
    const dash = view.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
    }
    ctx.stroke()
    ctx.setLineDash([])
    paintAttachmentOps(
      ctx,
      view.expanded ? view.attachments : withContrastingIcons(view.attachments, view.fill),
    )
    ctx.restore()
  }

  drawEdge(edge: GraphEdge, view: EdgePaintView): void {
    void edge
    const highlight = view.selected || view.hovered
    // Highlighted edges paint on the overlay canvas so node fills cannot cover them.
    const ctx = highlight ? this.overlayCtx : this.rootCtx
    ctx.save()
    ctx.globalAlpha = view.alpha
    ctx.beginPath()
    const arc = view.arc
    const points = view.points
    if (arc !== undefined) {
      // Canvas: angles grow clockwise with y-down; matches our atan2 sweep.
      const anticlockwise = !arc.clockwise
      ctx.arc(
        arc.center.x,
        arc.center.y,
        arc.radius,
        arc.startAngle,
        arc.endAngle,
        anticlockwise,
      )
    } else if (points !== undefined && points.length >= 2) {
      const corner = view.corner ?? 'round'
      const radius = view.cornerRadius ?? 8
      if (corner === 'none') {
        drawPlainPolyline(ctx, points)
      } else if (corner === 'bevel') {
        drawBevelPolyline(ctx, points, radius)
      } else {
        drawRoundedPolyline(ctx, points, radius)
      }
    } else {
      ctx.moveTo(view.from.x, view.from.y)
      if (view.orientation === 'horizontal') {
        const midX = (view.from.x + view.to.x) / 2
        ctx.bezierCurveTo(midX, view.from.y, midX, view.to.y, view.to.x, view.to.y)
      } else {
        const midY = (view.from.y + view.to.y) / 2
        ctx.bezierCurveTo(view.from.x, midY, view.to.x, midY, view.to.x, view.to.y)
      }
    }
    ctx.strokeStyle = view.stroke
    ctx.lineWidth = view.lineWidth / this.viewport.zoom
    ctx.lineJoin = view.corner === 'bevel' ? 'bevel' : 'round'
    ctx.lineCap = 'round'
    const dash = view.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
      if (view.flowDashOffset !== undefined) {
        ctx.lineDashOffset = view.flowDashOffset
      }
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
    if (view.arrowFrom !== undefined) drawEdgeArrow(ctx, view.arrowFrom, this.viewport.zoom)
    if (view.arrowTo !== undefined) drawEdgeArrow(ctx, view.arrowTo, this.viewport.zoom)
    paintAttachmentOps(ctx, view.attachments)
    ctx.restore()
  }

  drawPath(path: GraphPath, view: PathPaintView): void {
    void path
    this.paintPolylineElement(view)
  }

  drawShapeNode(shapeNode: GraphShapeNode, view: PathPaintView): void {
    void shapeNode
    this.paintPolylineElement(view)
  }

  /** Shared Path / ShapeNode stroke (+ optional closed fill + label). */
  private paintPolylineElement(view: PathPaintView): void {
    if (view.points.length < 2) return
    const highlight = view.selected || view.hovered
    const ctx = highlight ? this.overlayCtx : this.rootCtx
    ctx.save()
    ctx.globalAlpha = view.alpha
    if (view.anglePivot !== undefined) {
      rotateCanvasAbout(ctx, view.anglePivot, view.angle ?? 0)
    }
    ctx.beginPath()
    drawPlainPolyline(ctx, view.points)
    if (view.closed) ctx.closePath()
    const fill = view.fill
    if (view.closed && fill !== undefined && fill.length > 0) {
      ctx.fillStyle = fill
      ctx.fill()
    }
    applyPathChromeGlow(ctx, view)
    ctx.strokeStyle = view.stroke
    ctx.lineWidth = view.lineWidth / this.viewport.zoom
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const dash = view.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
    }
    ctx.stroke()
    ctx.setLineDash([])
    clearBodyOuterShadow(ctx)
    paintPathLabel(ctx, view.label)
    ctx.restore()
  }

  drawNode(node: GraphNode, view: NodePaintView): void {
    const bounds = view.bodyBounds
    const ctx = this.rootCtx
    const data = node.data ?? {}
    const fill = typeof data.fill === 'string' ? data.fill : statusFill(node.status)
    const stroke = typeof data.stroke === 'string' ? data.stroke : statusStroke(node.status)
    const lineWidth = (node.status === 'active' ? 2.5 : 1.25) / this.viewport.zoom

    ctx.save()
    ctx.globalAlpha = view.alpha
    rotateCanvasAbout(ctx, anglePivot(bounds, view.angleAnchor), view.angle ?? 0)
    applyBodyOuterShadow(ctx, view)

    const dash = view.strokeDash
    if (view.circular) {
      const cx = bounds.x + bounds.width / 2
      const cy = bounds.y + bounds.height / 2
      const r = Math.min(bounds.width, bounds.height) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      clearBodyOuterShadow(ctx)
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      if (dash !== undefined && dash.length > 0) ctx.setLineDash([...dash])
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      const radius = 8
      roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
      ctx.fillStyle = fill
      ctx.fill()
      clearBodyOuterShadow(ctx)
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      if (dash !== undefined && dash.length > 0) ctx.setLineDash([...dash])
      ctx.stroke()
      ctx.setLineDash([])
    }
    paintAttachmentOps(ctx, withContrastingIcons(view.attachments, fill))
    ctx.restore()
  }

  endFrame(): void {
    if (
      this.debugPaintRects
      && this.dirtyMode !== 'all'
      && this.dirtyMode !== 'overlay'
    ) {
      const ctx = this.overlayCtx
      ctx.save()
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 1 / this.viewport.zoom
      for (const rect of this.dirtyMode) {
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
      }
      ctx.restore()
    }
    if (this.rootFrameOpen) {
      this.rootCtx.restore()
      this.rootFrameOpen = false
    }
    this.overlayCtx.restore()
  }

  /**
   * Draw selection chrome on the overlay: solid ring only.
   * Soft glow paints under the body fill on the root canvas (twaver outer glow).
   * @param bounds - selected node body bounds.
   * @param style - optional chrome overrides.
   * @param alpha - whole-node opacity.
   * @param rotation - optional rotation about `pivot` (bounds stay unrotated).
   */
  drawSelectionOverlay(
    bounds: Rect,
    style?: NodePaintView['selectStyle'],
    alpha = 1,
    rotation?: OverlayRotation,
  ): void {
    const ctx = this.overlayCtx
    const pad = style?.padding ?? 2
    const color = style?.color ?? '#3b82f6'
    const x = bounds.x - pad
    const y = bounds.y - pad
    const w = bounds.width + pad * 2
    const h = bounds.height + pad * 2
    const radius = Math.min(8, w / 2, h / 2)
    ctx.save()
    ctx.globalAlpha = alpha
    if (rotation !== undefined) rotateCanvasAbout(ctx, rotation.pivot, rotation.angle)
    ctx.strokeStyle = color
    ctx.lineWidth = (style?.width ?? 2) / this.viewport.zoom
    ctx.setLineDash([])
    roundRect(ctx, x, y, w, h, radius)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * Draw hover chrome on the overlay: dashed ring by default; optional glow.
   * @param bounds - hovered node / group body bounds.
   * @param style - optional chrome overrides (`glow` defaults false).
   * @param alpha - whole-element opacity.
   * @param rotation - optional rotation about `pivot` (bounds stay unrotated).
   */
  drawHoverOverlay(
    bounds: Rect,
    style?: NodePaintView['hoverStyle'],
    alpha = 1,
    rotation?: OverlayRotation,
  ): void {
    const ctx = this.overlayCtx
    const pad = style?.padding ?? 2
    const color = style?.color ?? 'rgba(59, 130, 246, 0.65)'
    const x = bounds.x - pad
    const y = bounds.y - pad
    const w = bounds.width + pad * 2
    const h = bounds.height + pad * 2
    const radius = Math.min(8, w / 2, h / 2)
    ctx.save()
    ctx.globalAlpha = alpha
    if (rotation !== undefined) rotateCanvasAbout(ctx, rotation.pivot, rotation.angle)
    paintChromeGlow(ctx, { x, y, w, h, radius, color, alpha, style, enabledDefault: false })
    ctx.strokeStyle = color
    ctx.lineWidth = (style?.width ?? 1.5) / this.viewport.zoom
    ctx.setLineDash([4 / this.viewport.zoom, 3 / this.viewport.zoom])
    roundRect(ctx, x, y, w, h, radius)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  /**
   * Paint overlay-layer attachment ops (hover tooltip).
   * @param ops - overlay paint ops.
   * @param alpha - whole-node opacity.
   */
  drawOverlayAttachments(ops: readonly AttachmentPaintOp[], alpha = 1): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.globalAlpha = alpha
    paintAttachmentOps(ctx, ops)
    ctx.restore()
  }

  /**
   * Draw a marquee selection rect on the overlay (call after beginFrame, before endFrame).
   * @param rect - world-space marquee.
   */
  drawMarquee(rect: Rect): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.strokeStyle = '#3b82f6'
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
    ctx.lineWidth = 1 / this.viewport.zoom
    ctx.setLineDash([4 / this.viewport.zoom, 3 / this.viewport.zoom])
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
  }

  /**
   * Draw an edge-create rubber-band on the overlay.
   * @param from - world start.
   * @param to - world end (pointer).
   */
  drawEdgeRubberBand(from: Point, to: Point): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.5 / this.viewport.zoom
    ctx.setLineDash([6 / this.viewport.zoom, 4 / this.viewport.zoom])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * Draw a lazy-move ghost outline for a node bounds.
   * @param bounds - world-space ghost rect.
   */
  drawLazyMoveGhost(bounds: Rect): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)'
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.lineWidth = 1.5 / this.viewport.zoom
    ctx.setLineDash([5 / this.viewport.zoom, 4 / this.viewport.zoom])
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.restore()
  }

  /**
   * Draw a resize handle centered on a world point.
   * @param center - handle center in world space.
   * @param size - handle edge length in world space.
   */
  drawResizeHandle(center: Point, size: number): void {
    const ctx = this.overlayCtx
    const half = size / 2
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1 / this.viewport.zoom
    ctx.setLineDash([])
    ctx.fillRect(center.x - half, center.y - half, size, size)
    ctx.strokeRect(center.x - half, center.y - half, size, size)
    ctx.restore()
  }

  /**
   * Draw an edge bend handle (diamond) centered on a world point.
   * @param center - handle center in world space.
   * @param size - diamond diagonal in world space.
   */
  drawEdgeBendHandle(center: Point, size: number): void {
    const ctx = this.overlayCtx
    const half = size / 2
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1 / this.viewport.zoom
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(center.x, center.y - half)
    ctx.lineTo(center.x + half, center.y)
    ctx.lineTo(center.x, center.y + half)
    ctx.lineTo(center.x - half, center.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function resizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, dpr: number): void {
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
}

function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  arrow: EdgeArrowPaint,
  zoom: number,
): void {
  const { tip, direction, size, fill, stroke } = arrow
  const shape = arrow.shape ?? 'standard'
  const len = Math.hypot(direction.x, direction.y)
  const ux = len <= 1e-9 ? 1 : direction.x / len
  const uy = len <= 1e-9 ? 0 : direction.y / len
  const px = -uy
  const py = ux
  const s = shape === 'short' ? size * 0.7 : size
  const half = shape === 'delta' ? s * 0.55 : s * 0.45
  const backX = tip.x - ux * s
  const backY = tip.y - uy * s
  ctx.beginPath()
  if (shape === 'diamond') {
    const midX = tip.x - ux * s * 0.5
    const midY = tip.y - uy * s * 0.5
    const tailX = tip.x - ux * s
    const tailY = tip.y - uy * s
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(midX + px * half, midY + py * half)
    ctx.lineTo(tailX, tailY)
    ctx.lineTo(midX - px * half, midY - py * half)
  } else if (shape === 'slant') {
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(backX + px * half, backY + py * half * 0.2)
    ctx.lineTo(backX - px * half * 0.35, backY - py * half)
  } else {
    // standard / delta / short — filled triangle
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(backX + px * half, backY + py * half)
    ctx.lineTo(backX - px * half, backY - py * half)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1 / zoom
  ctx.stroke()
}

function paintAttachmentOps(
  ctx: CanvasRenderingContext2D,
  ops: readonly AttachmentPaintOp[],
): void {
  for (const op of ops) {
    switch (op.kind) {
      case 'label':
      case 'label2': {
        ctx.fillStyle = op.color
        const weight = op.fontWeight === 'bold' ? 'bold ' : ''
        ctx.font = `${weight}${op.fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          op.text,
          op.bounds.x + op.bounds.width / 2,
          op.bounds.y + op.bounds.height / 2,
        )
        ctx.textAlign = 'start'
        break
      }
      case 'icons': {
        const icon = getIcon(op.iconKey)
        const size = Math.min(op.bounds.width, op.bounds.height)
        ctx.save()
        ctx.translate(op.bounds.x, op.bounds.y)
        icon.draw(ctx, size, op.color ?? '#e8eaed')
        ctx.restore()
        break
      }
      case 'alarm': {
        const cx = op.bounds.x + op.bounds.width / 2
        const cy = op.bounds.y + op.bounds.height / 2
        if (op.variant === 'tag') {
          const ink = op.color
            ?? (op.level === 'error'
              ? '#bf4520'
              : op.level === 'warn'
                ? '#fb923c'
                : '#4f5d75')
          roundRect(ctx, op.bounds.x, op.bounds.y, op.bounds.width, op.bounds.height, 2)
          ctx.strokeStyle = withAlpha(ink, 0.45)
          ctx.lineWidth = 0.8
          ctx.stroke()
          if (op.text !== undefined && op.text.length > 0) {
            ctx.fillStyle = ink
            ctx.font = `${op.fontSize ?? 7}px monospace`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(op.text, cx, cy + 0.5)
            ctx.textAlign = 'start'
          }
          break
        }
        const radius = op.radius ?? Math.min(op.bounds.width, op.bounds.height) / 2
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        // Warm palette on dark canvases; keep error distinct but orange-red.
        ctx.fillStyle = op.level === 'error'
          ? '#f97316'
          : op.level === 'warn'
            ? '#fb923c'
            : '#fbbf24'
        ctx.fill()
        if (op.text !== undefined && op.text.length > 0) {
          ctx.fillStyle = '#1a1d24'
          ctx.font = `bold ${Math.max(9, Math.round(radius))}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(op.text, cx, cy + 0.5)
          ctx.textAlign = 'start'
        }
        break
      }
      case 'tooltip': {
        const { bounds } = op
        const r = 4
        roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, r)
        ctx.fillStyle = op.background
        ctx.fill()
        ctx.fillStyle = op.color
        ctx.font = `${op.fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lines = op.lines ?? op.text.split('\n')
        const lineHeight = op.fontSize * 1.25
        const total = lines.length * lineHeight
        const startY = bounds.y + (bounds.height - total) / 2 + lineHeight / 2
        const cx = bounds.x + bounds.width / 2
        for (let i = 0; i < lines.length; i += 1) {
          ctx.fillText(lines[i]!, cx, startY + i * lineHeight)
        }
        ctx.textAlign = 'start'
        break
      }
      default: {
        const _exhaustive: never = op
        throw new Error(`unhandled attachment paint: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }
}

/** Light glyph on dark fills, dark glyph on light fills. */
function withContrastingIcons(
  ops: readonly AttachmentPaintOp[],
  fill: string,
): readonly AttachmentPaintOp[] {
  const color = contrastingInk(fill)
  return ops.map(op => (op.kind === 'icons' ? { ...op, color } : op))
}

/**
 * Pick readable ink for a CSS fill (hex / rgb / rgba). Unparsed → light ink.
 * @param fill - body fill color.
 */
function contrastingInk(fill: string): string {
  const rgb = parseCssRgb(fill)
  if (rgb === undefined) return '#e8eaed'
  // Relative luminance (sRGB).
  const [r, g, b] = rgb.map(channel => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? '#111827' : '#e8eaed'
}

/** Apply alpha to a parseable CSS color; unparsed colors are returned unchanged. */
function withAlpha(color: string, alpha: number): string {
  const rgb = parseCssRgb(color)
  if (rgb === undefined) return color
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
}

/**
 * @param color - CSS color string.
 * @returns RGB 0–255 or undefined.
 */
function parseCssRgb(color: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex !== null) {
    const h = hex[1]!
    if (h.length === 3) {
      return [
        Number.parseInt(h[0]! + h[0]!, 16),
        Number.parseInt(h[1]! + h[1]!, 16),
        Number.parseInt(h[2]! + h[2]!, 16),
      ]
    }
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
    ]
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color.trim())
  if (rgb !== null) {
    return [
      Number.parseFloat(rgb[1]!),
      Number.parseFloat(rgb[2]!),
      Number.parseFloat(rgb[3]!),
    ]
  }
  return undefined
}

function statusFill(status: string | undefined): string {
  switch (status) {
    case 'running':
      return '#143528'
    case 'active':
      return '#3a2a10'
    case 'error':
      return '#3a1518'
    case 'cold':
      return '#1a1d24'
    case 'done':
      return '#143528'
    case 'idle':
      return '#1a2438'
    default:
      return '#1a1d24'
  }
}

function statusStroke(status: string | undefined): string {
  switch (status) {
    case 'running':
      return '#3dd68c'
    case 'active':
      return '#f5a524'
    case 'error':
      return '#f07178'
    case 'cold':
      return '#8b93a7'
    case 'done':
      return '#3dd68c'
    case 'idle':
      return '#5b8def'
    default:
      return '#334155'
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Soft overlay glow via a padded fill + shadowBlur (hover opt-in only).
 * Selection glow uses {@link applyBodyOuterShadow} under the body fill instead.
 * @param enabledDefault - when style.glow is omitted: hover false.
 */
function paintChromeGlow(
  ctx: CanvasRenderingContext2D,
  args: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
    readonly radius: number
    readonly color: string
    readonly alpha: number
    readonly style?: NodePaintView['hoverStyle'] | NodePaintView['selectStyle']
    readonly enabledDefault: boolean
  },
): void {
  const enabled = args.style?.glow ?? args.enabledDefault
  if (!enabled) return
  const blur = args.style?.glowBlur ?? 16
  ctx.shadowColor = args.color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = args.color
  roundRect(ctx, args.x, args.y, args.w, args.h, args.radius)
  ctx.globalAlpha = args.alpha * 0.35
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = args.alpha
}

/**
 * Selection glow (twaver outer.style glow) or drop shadow, applied before body fill
 * so the halo sits under the opaque fill rather than as an overlay veil.
 */
function applyBodyOuterShadow(
  ctx: CanvasRenderingContext2D,
  view: {
    readonly selected: boolean
    readonly selectStyle?: NodePaintView['selectStyle']
    readonly shadow?: NodePaintView['shadow']
  },
): void {
  const glowOn = view.selected && (view.selectStyle?.glow ?? true)
  if (glowOn) {
    ctx.shadowColor = view.selectStyle?.color ?? '#3b82f6'
    ctx.shadowBlur = view.selectStyle?.glowBlur ?? 16
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    return
  }
  if (view.shadow === undefined) return
  ctx.shadowColor = view.shadow.color ?? 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = view.shadow.blur ?? 6
  ctx.shadowOffsetX = view.shadow.offsetX ?? 0
  ctx.shadowOffsetY = view.shadow.offsetY ?? 2
}

function clearBodyOuterShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/**
 * Soft glow along a highlighted path stroke (select default on; hover default off).
 */
function applyPathChromeGlow(
  ctx: CanvasRenderingContext2D,
  view: PathPaintView,
): void {
  if (view.selected) {
    const style = view.selectStyle
    if (!(style?.glow ?? true)) return
    ctx.shadowColor = style?.color ?? view.stroke
    ctx.shadowBlur = style?.glowBlur ?? 16
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    return
  }
  if (!view.hovered) return
  const style = view.hoverStyle
  if (!(style?.glow ?? false)) return
  ctx.shadowColor = style?.color ?? view.stroke
  ctx.shadowBlur = style?.glowBlur ?? 16
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/** Midpoint-above path label (v1 fillText). */
function paintPathLabel(
  ctx: CanvasRenderingContext2D,
  label: PathLabelPaint | undefined,
): void {
  if (label === undefined || label.text.length === 0) return
  const weight = label.fontWeight === 'bold' ? 'bold ' : ''
  ctx.fillStyle = label.color
  ctx.font = `${weight}${label.fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.text, label.x, label.y)
  ctx.textAlign = 'start'
}

function drawPlainPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
): void {
  if (points.length === 0) return
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y)
  }
}

function drawBevelPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  inset: number,
): void {
  if (points.length < 3) {
    drawPlainPolyline(ctx, points)
    return
  }
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y)
    const r = Math.min(inset, d1 / 2, d2 / 2)
    if (r < 0.5) {
      ctx.lineTo(curr.x, curr.y)
      continue
    }
    ctx.lineTo(
      curr.x - ((curr.x - prev.x) / d1) * r,
      curr.y - ((curr.y - prev.y) / d1) * r,
    )
    ctx.lineTo(
      curr.x + ((next.x - curr.x) / d2) * r,
      curr.y + ((next.y - curr.y) / d2) * r,
    )
  }
  const last = points[points.length - 1]!
  ctx.lineTo(last.x, last.y)
}

/**
 * Orthogonal polyline with quadratic rounded elbows (Link-like).
 * @param ctx - canvas context (path already begun).
 * @param points - route points including endpoints.
 * @param corner - max corner radius in world units.
 */
function drawRoundedPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  corner: number,
): void {
  if (points.length === 0) return
  if (points.length === 1) {
    ctx.moveTo(points[0]!.x, points[0]!.y)
    return
  }
  if (points.length === 2) {
    ctx.moveTo(points[0]!.x, points[0]!.y)
    ctx.lineTo(points[1]!.x, points[1]!.y)
    return
  }
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y)
    const r = Math.min(corner, d1 / 2, d2 / 2)
    if (r < 0.5) {
      ctx.lineTo(curr.x, curr.y)
      continue
    }
    const before = {
      x: curr.x - ((curr.x - prev.x) / d1) * r,
      y: curr.y - ((curr.y - prev.y) / d1) * r,
    }
    const after = {
      x: curr.x + ((next.x - curr.x) / d2) * r,
      y: curr.y + ((next.y - curr.y) / d2) * r,
    }
    ctx.lineTo(before.x, before.y)
    ctx.quadraticCurveTo(curr.x, curr.y, after.x, after.y)
  }
  const last = points[points.length - 1]!
  ctx.lineTo(last.x, last.y)
}

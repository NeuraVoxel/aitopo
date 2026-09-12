/**
 * Renderer abstraction and Canvas 2D implementation.
 */

import type { Point, Rect } from '../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'
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
  }
  readonly hoverStyle?: {
    readonly color?: string
    readonly width?: number
    readonly padding?: number
  }
  /** Scene-layer attachment paint ops. */
  readonly attachments: readonly AttachmentPaintOp[]
  /** Overlay-layer attachment paint ops (e.g. hover tooltip). */
  readonly overlayAttachments: readonly AttachmentPaintOp[]
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
  /** Whole-edge opacity `[0, 1]`; default `1`. */
  readonly alpha: number
  readonly stroke: string
  readonly lineWidth: number
  readonly strokeDash?: readonly number[]
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
}

/** Cached geometry for a group band. */
export interface GroupPaintView {
  readonly bounds: Rect
  readonly bandBounds: Rect
  readonly unionBounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
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
  drawNode(node: GraphNode, view: NodePaintView): void
  endFrame(): void
  /** Overlay: selection ring (no-op OK for headless fakes). */
  drawSelectionOverlay(bounds: Rect, style?: NodePaintView['selectStyle'], alpha?: number): void
  /** Overlay: hover ring (lighter than selection; no-op OK for fakes). */
  drawHoverOverlay(bounds: Rect, style?: NodePaintView['hoverStyle'], alpha?: number): void
  /** Overlay attachment ops (hover tooltip). */
  drawOverlayAttachments?(ops: readonly AttachmentPaintOp[], alpha?: number): void
  /** Overlay: marquee rubber band. */
  drawMarquee(rect: Rect): void
  /** Overlay: edge-create rubber band. */
  drawEdgeRubberBand(from: Point, to: Point): void
  /** Overlay: ghost outline while lazy-moving a node. */
  drawLazyMoveGhost(bounds: Rect): void
  /** Overlay: highlight group under pointer during membership drop. */
  drawDropTargetHighlight(bounds: Rect): void
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
    if (view.shadow !== undefined) {
      ctx.shadowColor = view.shadow.color ?? 'rgba(0, 0, 0, 0.35)'
      ctx.shadowBlur = view.shadow.blur ?? 6
      ctx.shadowOffsetX = view.shadow.offsetX ?? 0
      ctx.shadowOffsetY = view.shadow.offsetY ?? 2
    }
    const strokeWidth = view.strokeWidth / this.viewport.zoom
    const radius = view.expanded ? 12 : 8
    roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
    ctx.fillStyle = view.fill
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.strokeStyle = view.stroke
    ctx.lineWidth = strokeWidth
    const dash = view.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
    }
    ctx.stroke()
    ctx.setLineDash([])
    paintAttachmentOps(ctx, view.attachments)
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
    const points = view.points
    if (points !== undefined && points.length >= 2) {
      drawRoundedPolyline(ctx, points, 8)
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
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const dash = view.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
    }
    ctx.stroke()
    ctx.setLineDash([])
    if (view.arrowFrom !== undefined) drawEdgeArrow(ctx, view.arrowFrom, this.viewport.zoom)
    if (view.arrowTo !== undefined) drawEdgeArrow(ctx, view.arrowTo, this.viewport.zoom)
    paintAttachmentOps(ctx, view.attachments)
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
    if (view.shadow !== undefined) {
      ctx.shadowColor = view.shadow.color ?? 'rgba(0, 0, 0, 0.35)'
      ctx.shadowBlur = view.shadow.blur ?? 6
      ctx.shadowOffsetX = view.shadow.offsetX ?? 0
      ctx.shadowOffsetY = view.shadow.offsetY ?? 2
    }

    if (view.circular) {
      const cx = bounds.x + bounds.width / 2
      const cy = bounds.y + bounds.height / 2
      const r = Math.min(bounds.width, bounds.height) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.stroke()
    } else {
      const radius = 8
      roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.stroke()
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
   * Draw selection strokes on the overlay canvas (call after beginFrame).
   * @param bounds - selected node body bounds.
   * @param style - optional chrome overrides.
   * @param alpha - whole-node opacity.
   */
  drawSelectionOverlay(
    bounds: Rect,
    style?: NodePaintView['selectStyle'],
    alpha = 1,
  ): void {
    const ctx = this.overlayCtx
    const pad = style?.padding ?? 2
    const width = (style?.width ?? 2) / this.viewport.zoom
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = style?.color ?? '#3b82f6'
    ctx.lineWidth = width
    ctx.setLineDash([])
    ctx.strokeRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
    )
    ctx.restore()
  }

  /**
   * Draw a hover ring on the overlay (lighter than selection).
   * @param bounds - hovered node body bounds.
   * @param style - optional chrome overrides.
   * @param alpha - whole-node opacity.
   */
  drawHoverOverlay(
    bounds: Rect,
    style?: NodePaintView['hoverStyle'],
    alpha = 1,
  ): void {
    const ctx = this.overlayCtx
    const pad = style?.padding ?? 2
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = style?.color ?? 'rgba(59, 130, 246, 0.65)'
    ctx.lineWidth = (style?.width ?? 1.5) / this.viewport.zoom
    ctx.setLineDash([4 / this.viewport.zoom, 3 / this.viewport.zoom])
    ctx.strokeRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
    )
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
   * Draw a drop-target group highlight on the overlay.
   * @param bounds - group band bounds.
   */
  drawDropTargetHighlight(bounds: Rect): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.strokeStyle = '#22c55e'
    ctx.fillStyle = 'rgba(34, 197, 94, 0.12)'
    ctx.lineWidth = 2 / this.viewport.zoom
    ctx.setLineDash([])
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
  const len = Math.hypot(direction.x, direction.y)
  const ux = len <= 1e-9 ? 1 : direction.x / len
  const uy = len <= 1e-9 ? 0 : direction.y / len
  const px = -uy
  const py = ux
  const backX = tip.x - ux * size
  const backY = tip.y - uy * size
  const half = size * 0.45
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(backX + px * half, backY + py * half)
  ctx.lineTo(backX - px * half, backY - py * half)
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
        ctx.font = `${op.fontSize}px sans-serif`
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
        ctx.beginPath()
        ctx.arc(cx, cy, op.radius, 0, Math.PI * 2)
        // Warm palette on dark canvases; keep error distinct but orange-red.
        ctx.fillStyle = op.level === 'error'
          ? '#f97316'
          : op.level === 'warn'
            ? '#fb923c'
            : '#fbbf24'
        ctx.fill()
        if (op.text !== undefined && op.text.length > 0) {
          ctx.fillStyle = '#1a1d24'
          ctx.font = `bold ${Math.max(9, Math.round(op.radius))}px sans-serif`
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
        ctx.fillText(
          op.text,
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        )
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

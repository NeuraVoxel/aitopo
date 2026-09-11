/**
 * Renderer abstraction and Canvas 2D implementation.
 */

import type { Point, Rect } from '../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'

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
  readonly bounds: Rect
  readonly selected: boolean
  readonly hovered: boolean
  /** Truncated primary label for paint. */
  readonly label: string
  /** Truncated secondary/meta line when present. */
  readonly meta?: string
  /** Circle body (tool / data.shape). */
  readonly circular: boolean
  /** Alarm badge in world space when the node has alarms. */
  readonly alarm?: {
    readonly level: 'info' | 'warn' | 'error'
    readonly x: number
    readonly y: number
    readonly radius: number
  }
}

/** Cached geometry for an edge paint. */
export interface EdgePaintView {
  readonly from: { x: number; y: number }
  readonly to: { x: number; y: number }
  readonly selected: boolean
  readonly hovered: boolean
  /** Prefer horizontal vs vertical control points for the bezier. */
  readonly orientation?: 'horizontal' | 'vertical'
  /** Orthogonal polyline (includes endpoints); drawn with rounded elbows. */
  readonly points?: readonly { x: number; y: number }[]
}

/** Cached geometry for a group band. */
export interface GroupPaintView {
  readonly bounds: Rect
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
  drawSelectionOverlay(bounds: Rect): void
  /** Overlay: hover ring (lighter than selection; no-op OK for fakes). */
  drawHoverOverlay(bounds: Rect): void
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
    const { bounds } = view
    const ctx = this.rootCtx
    const style = group.style ?? {}
    const stroke = style.stroke ?? '#5a6478'
    const fill = style.fill ?? 'rgba(90, 100, 120, 0.08)'
    const strokeWidth = (style.strokeWidth ?? 1) / this.viewport.zoom
    const radius = 12
    roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = strokeWidth
    const dash = style.strokeDash
    if (dash !== undefined && dash.length > 0) {
      ctx.setLineDash([...dash])
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = stroke
    // World-space font — scales with viewport zoom (do not divide by zoom).
    ctx.font = '12px sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(group.label, bounds.x + 8, bounds.y + 6)
  }

  drawEdge(edge: GraphEdge, view: EdgePaintView): void {
    const highlight = view.selected || view.hovered
    // Highlighted edges paint on the overlay canvas so node fills cannot cover them.
    const ctx = highlight ? this.overlayCtx : this.rootCtx
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
    const data = edge.data ?? {}
    const baseStroke = typeof data.stroke === 'string' ? data.stroke : '#5a6478'
    const hoverStroke = typeof data.strokeHover === 'string' ? data.strokeHover : '#3b82f6'
    const baseWidth = typeof data.lineWidth === 'number' ? data.lineWidth : 1.25
    ctx.strokeStyle = highlight ? hoverStroke : baseStroke
    ctx.lineWidth = (highlight ? Math.max(baseWidth, 2.5) : baseWidth) / this.viewport.zoom
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    const label = typeof data.label === 'string' ? data.label : undefined
    if (label !== undefined && label.length > 0) {
      let mx: number
      let my: number
      if (points !== undefined && points.length >= 2) {
        const mid = Math.floor((points.length - 1) / 2)
        const a = points[mid]!
        const b = points[Math.min(points.length - 1, mid + 1)]!
        mx = (a.x + b.x) / 2
        my = (a.y + b.y) / 2
      } else {
        mx = (view.from.x + view.to.x) / 2
        my = (view.from.y + view.to.y) / 2
      }
      ctx.font = '9px sans-serif'
      ctx.fillStyle = highlight ? hoverStroke : '#8b939e'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(label, mx, my - 3)
      ctx.textAlign = 'start'
    }
  }

  drawNode(node: GraphNode, view: NodePaintView): void {
    const { bounds } = view
    const ctx = this.rootCtx
    const data = node.data ?? {}
    const fill = typeof data.fill === 'string' ? data.fill : statusFill(node.status)
    // Select/hover emphasis lives on the overlay (rings); root stroke is status/data only.
    const stroke = typeof data.stroke === 'string' ? data.stroke : statusStroke(node.status)
    const labelColor = typeof data.labelColor === 'string' ? data.labelColor : '#e8eaed'
    const metaColor = typeof data.metaColor === 'string' ? data.metaColor : '#a8b0c0'
    const lineWidth = (node.status === 'active' ? 2.5 : 1.25) / this.viewport.zoom
    if (view.circular) {
      const cx = bounds.x + bounds.width / 2
      const cy = bounds.y + bounds.height / 2
      const r = Math.min(bounds.width, bounds.height) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.stroke()
      ctx.fillStyle = labelColor
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(view.label, cx, cy)
      ctx.textAlign = 'start'
    } else {
      const radius = 8
      roundRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, radius)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.stroke()
      ctx.fillStyle = labelColor
      ctx.font = '12px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(view.label, bounds.x + 12, bounds.y + bounds.height / 2 - 6)
      if (view.meta !== undefined) {
        ctx.fillStyle = metaColor
        ctx.font = '10px sans-serif'
        ctx.fillText(view.meta, bounds.x + 12, bounds.y + bounds.height / 2 + 10)
      }
    }
    const alarm = view.alarm
    if (alarm !== undefined) {
      ctx.beginPath()
      ctx.arc(alarm.x, alarm.y, alarm.radius, 0, Math.PI * 2)
      ctx.fillStyle = alarm.level === 'error' ? '#ef4444' : alarm.level === 'warn' ? '#f59e0b' : '#3b82f6'
      ctx.fill()
    }
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
   * @param bounds - selected node bounds.
   */
  drawSelectionOverlay(bounds: Rect): void {
    const ctx = this.overlayCtx
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2 / this.viewport.zoom
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
  }

  /**
   * Draw a hover ring on the overlay (lighter than selection).
   * @param bounds - hovered node bounds.
   */
  drawHoverOverlay(bounds: Rect): void {
    const ctx = this.overlayCtx
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.65)'
    ctx.lineWidth = 1.5 / this.viewport.zoom
    ctx.setLineDash([4 / this.viewport.zoom, 3 / this.viewport.zoom])
    ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4)
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
}

function resizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, dpr: number): void {
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
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

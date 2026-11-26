/**
 * Cached shape-node geometry and paint style (densify via path-route).
 */

import {
  distanceToPolyline,
  growRect,
  type Point,
  type Rect,
  unionRect,
} from '../geom.ts'
import type { GraphChromeStyle, GraphShapeNode, GraphTextStyle } from '../protocol/types.ts'
import type { PathPaintView } from '../render/canvas2d.ts'
import { samplePolylineAt } from './attachment/path.ts'
import {
  resolveMaxChars,
  truncateText,
} from './attachment/label-attachment.ts'
import { estimateTextSize } from './attachment/position.ts'
import { unionPoint } from './bounds.ts'
import { buildPathPolyline } from './path-route.ts'

const SHAPE_BOUNDS_PAD = 4
const DEFAULT_STROKE = '#5a6478'
const DEFAULT_STROKE_HOVER = '#3b82f6'
const DEFAULT_LINE_WIDTH = 1.25
const DEFAULT_LABEL_COLOR = '#000000'
const DEFAULT_LABEL_FONT = 11
/** World px from stroke sample to label center (above). */
const DEFAULT_LABEL_GAP = 8
/** Unlimited when style.label.maxChars omitted (same as paths/nodes). */
const DEFAULT_SHAPE_MAX_CHARS = 0

/**
 * Per-shape-node View: sync densified polyline + style; hit + paint getters.
 * Closed semantics: omitted `closed` ≡ closed (`shapeNode.closed !== false`).
 */
export class ShapeNodeView {
  readonly id: string
  private dirty = true
  private pointsCache: readonly Point[] = []
  private shapeBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private closed = true
  private alphaCache = 1
  private strokeCache = DEFAULT_STROKE
  private fillCache: string | undefined
  private lineWidthCache = DEFAULT_LINE_WIDTH
  private strokeDashCache: readonly number[] | undefined
  private labelCache: string | undefined
  private labelColor = DEFAULT_LABEL_COLOR
  private labelFontSize = DEFAULT_LABEL_FONT
  private labelFontWeight: 'normal' | 'bold' = 'normal'
  /** Label text-box center (midpoint sample + upward gap); undefined when no label. */
  private labelCenter: Point | undefined
  private selectStyle: GraphChromeStyle | undefined
  private hoverStyle: GraphChromeStyle | undefined

  constructor(id: string) {
    this.id = id
  }

  /** Mark geometry/style stale so the next validate re-syncs. */
  markDirty(): void {
    this.dirty = true
  }

  /** Densified polyline AABB (+ pad, label) for dirty-rect / hit culling. */
  get bounds(): Rect {
    return this.shapeBounds
  }

  /** Validated densified polyline (paint + hit). */
  get points(): readonly Point[] {
    return this.pointsCache
  }

  get stroke(): string {
    return this.strokeCache
  }

  get fill(): string | undefined {
    return this.fillCache
  }

  get lineWidth(): number {
    return this.lineWidthCache
  }

  get alpha(): number {
    return this.alphaCache
  }

  get strokeDash(): readonly number[] | undefined {
    return this.strokeDashCache
  }

  get label(): string | undefined {
    return this.labelCache
  }

  /**
   * World center of the painted label (densified midpoint, above stroke).
   * Undefined when the shape node has no label text.
   */
  get labelPosition(): Point | undefined {
    return this.labelCenter
  }

  get isClosed(): boolean {
    return this.closed
  }

  get select(): GraphChromeStyle | undefined {
    return this.selectStyle
  }

  get hover(): GraphChromeStyle | undefined {
    return this.hoverStyle
  }

  /**
   * Recompute densified points, bounds, and style cache from a shape-node element.
   */
  sync(shapeNode: GraphShapeNode): void {
    const kind = shapeNode.style?.shapeKind ?? 'lineto'
    // Omitted closed ≡ closed (opposite of Path).
    const closed = shapeNode.closed !== false
    this.closed = closed
    this.pointsCache = buildPathPolyline(shapeNode.points, kind, closed)
    let box: Rect | undefined
    for (const point of this.pointsCache) {
      box = unionPoint(box, point)
    }
    const pad = Math.max(
      SHAPE_BOUNDS_PAD,
      (shapeNode.style?.lineWidth ?? DEFAULT_LINE_WIDTH) / 2 + 2,
    )
    this.shapeBounds = growRect(
      box ?? { x: 0, y: 0, width: 0, height: 0 },
      pad,
    )
    this.alphaCache = clampAlpha(shapeNode.style?.alpha)
    this.strokeCache = shapeNode.style?.stroke ?? DEFAULT_STROKE
    this.fillCache = shapeNode.style?.fill
    this.lineWidthCache = shapeNode.style?.lineWidth ?? DEFAULT_LINE_WIDTH
    this.strokeDashCache = shapeNode.style?.strokeDash
    this.selectStyle = shapeNode.style?.select
    this.hoverStyle = shapeNode.style?.hover
    this.syncLabel(shapeNode.label, shapeNode.style?.label)
    this.dirty = false
  }

  /**
   * Sync from scene when dirty (no-op when already valid).
   * @param shapeNode - live shape-node element, or undefined to clear cache.
   */
  validate(shapeNode: GraphShapeNode | undefined): void {
    if (!this.dirty) return
    if (shapeNode === undefined) {
      this.pointsCache = []
      this.shapeBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.labelCache = undefined
      this.labelCenter = undefined
      this.dirty = false
      return
    }
    this.sync(shapeNode)
  }

  /**
   * Hit-test densified segments; closed + fill also hits polygon interior.
   */
  hit(worldX: number, worldY: number, threshold: number): boolean {
    if (this.pointsCache.length < 2) return false
    const point = { x: worldX, y: worldY }
    if (distanceToPolyline(point, this.pointsCache) <= threshold) return true
    if (this.closed && this.fillCache !== undefined && this.fillCache.length > 0) {
      return pointInPolygon(point, this.pointsCache)
    }
    return false
  }

  /**
   * Build a paint DTO for the renderer (same shape as PathPaintView until Task 4).
   * @param selected - selection highlight.
   * @param hovered - hover highlight.
   */
  toPaintView(selected: boolean, hovered: boolean): PathPaintView {
    let resolvedStroke = this.strokeCache
    let paintWidth = this.lineWidthCache
    if (hovered && !selected) {
      resolvedStroke = this.hoverStyle?.color ?? DEFAULT_STROKE_HOVER
      paintWidth = Math.max(this.lineWidthCache, this.hoverStyle?.width ?? 2.5)
      if (this.hoverStyle?.padding !== undefined) {
        paintWidth += this.hoverStyle.padding * 2
      }
    } else if (selected) {
      resolvedStroke = this.selectStyle?.color ?? DEFAULT_STROKE_HOVER
      paintWidth = Math.max(this.lineWidthCache, this.selectStyle?.width ?? 2.5)
      if (this.selectStyle?.padding !== undefined) {
        paintWidth += this.selectStyle.padding * 2
      }
    }
    return {
      points: this.pointsCache,
      bounds: this.shapeBounds,
      selected,
      hovered,
      closed: this.closed,
      alpha: this.alphaCache,
      stroke: resolvedStroke,
      ...(this.fillCache !== undefined ? { fill: this.fillCache } : {}),
      lineWidth: paintWidth,
      ...(this.strokeDashCache !== undefined ? { strokeDash: this.strokeDashCache } : {}),
      ...(this.labelCache !== undefined && this.labelCenter !== undefined
        ? {
          label: {
            text: this.labelCache,
            x: this.labelCenter.x,
            y: this.labelCenter.y,
            color: this.labelColor,
            fontSize: this.labelFontSize,
            ...(this.labelFontWeight !== 'normal'
              ? { fontWeight: this.labelFontWeight }
              : {}),
          },
        }
        : {}),
      ...(this.selectStyle !== undefined ? { selectStyle: this.selectStyle } : {}),
      ...(this.hoverStyle !== undefined ? { hoverStyle: this.hoverStyle } : {}),
    }
  }

  /**
   * Cache truncated label text + midpoint-above position; union into bounds.
   */
  private syncLabel(
    raw: string | undefined,
    style: GraphTextStyle | undefined,
  ): void {
    this.labelColor = style?.color ?? DEFAULT_LABEL_COLOR
    this.labelFontSize = style?.fontSize ?? DEFAULT_LABEL_FONT
    this.labelFontWeight = style?.fontWeight ?? 'normal'
    const text = truncateText(
      raw ?? '',
      resolveMaxChars(style, DEFAULT_SHAPE_MAX_CHARS),
    )
    if (text.length === 0 || this.pointsCache.length < 2) {
      this.labelCache = undefined
      this.labelCenter = undefined
      return
    }
    this.labelCache = text
    const { point } = samplePolylineAt(this.pointsCache, 0.5)
    // v1: always above the stroke (y-down); labelSide later.
    this.labelCenter = { x: point.x, y: point.y - DEFAULT_LABEL_GAP }
    const size = estimateTextSize(text, this.labelFontSize, this.labelFontWeight)
    const labelBox: Rect = {
      x: this.labelCenter.x - size.width / 2,
      y: this.labelCenter.y - size.height / 2,
      width: size.width,
      height: size.height,
    }
    this.shapeBounds = unionRect(this.shapeBounds, labelBox) ?? this.shapeBounds
  }
}

/** Clamp style.alpha into `[0, 1]`; omitted → opaque. */
function clampAlpha(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

/**
 * Ray-cast point-in-polygon (even-odd). Expects closed ring (last≈first ok).
 */
function pointInPolygon(point: Point, ring: readonly Point[]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = ring[i]!
    const b = ring[j]!
    const intersects = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

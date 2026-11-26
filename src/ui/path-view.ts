/**
 * Cached freestanding path geometry and paint style for ViewSet / Network.
 */

import {
  anglePivot,
  distanceToPolyline,
  growRect,
  inverseRotatePointAround,
  normalizeAngleDegrees,
  rotatedAabbOfRectAbout,
  type Point,
  type Rect,
  unionRect,
} from '../geom.ts'
import type {
  GraphAngleAnchor,
  GraphChromeStyle,
  GraphPath,
  GraphTextStyle,
} from '../protocol/types.ts'
import type { PathPaintView } from '../render/canvas2d.ts'
import { samplePolylineAt } from './attachment/path.ts'
import {
  resolveMaxChars,
  truncateText,
} from './attachment/label-attachment.ts'
import { estimateTextSize } from './attachment/position.ts'
import { unionPoint } from './bounds.ts'
import { buildPathPolyline } from './path-route.ts'

const PATH_BOUNDS_PAD = 4
const DEFAULT_STROKE = '#5a6478'
const DEFAULT_STROKE_HOVER = '#3b82f6'
const DEFAULT_LINE_WIDTH = 1.25
const DEFAULT_LABEL_COLOR = '#000000'
const DEFAULT_LABEL_FONT = 11
/** World px from stroke sample to label center (above). */
const DEFAULT_LABEL_GAP = 8
/** Unlimited when style.label.maxChars omitted (same as nodes). */
const DEFAULT_PATH_MAX_CHARS = 0

/** Per-path View: sync densified polyline + style; hit + paint getters. */
export class PathView {
  readonly id: string
  private dirty = true
  private pointsCache: readonly Point[] = []
  /** Rotated AABB of {@link originalBounds} (dirty / cull); equals it when angle ≡ 0. */
  private pathBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Unrotated padded polyline ∪ label AABB. */
  private originalBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Unrotated densified polyline AABB (no pad / label); pivot reference. */
  private pointsBox: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private angleDeg = 0
  private angleAnchorCache: GraphAngleAnchor | undefined
  private closed = false
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
    return this.pathBounds
  }

  /** Unrotated padded polyline ∪ label AABB. */
  get originalAabb(): Rect {
    return this.originalBounds
  }

  /** Normalized rotation degrees (`0` when omitted). */
  get angle(): number {
    return this.angleDeg
  }

  /** Authored relative pivot; undefined ≡ center. */
  get angleAnchor(): GraphAngleAnchor | undefined {
    return this.angleAnchorCache
  }

  /** World rotation pivot inside the original densified polyline AABB. */
  get pivot(): Point {
    return anglePivot(this.pointsBox, this.angleAnchorCache)
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
   * Undefined when the path has no label text.
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
   * Recompute densified points, bounds, and style cache from a path element.
   */
  sync(path: GraphPath): void {
    const kind = path.style?.shapeKind ?? 'lineto'
    const closed = path.closed === true
    this.closed = closed
    this.pointsCache = buildPathPolyline(path.points, kind, closed)
    let box: Rect | undefined
    for (const point of this.pointsCache) {
      box = unionPoint(box, point)
    }
    const pad = Math.max(
      PATH_BOUNDS_PAD,
      (path.style?.lineWidth ?? DEFAULT_LINE_WIDTH) / 2 + 2,
    )
    this.pointsBox = box ?? { x: 0, y: 0, width: 0, height: 0 }
    this.angleDeg = normalizeAngleDegrees(path.angle ?? 0)
    this.angleAnchorCache = path.angleAnchor
    this.pathBounds = growRect(this.pointsBox, pad)
    this.alphaCache = clampAlpha(path.style?.alpha)
    this.strokeCache = path.style?.stroke ?? DEFAULT_STROKE
    this.fillCache = path.style?.fill
    this.lineWidthCache = path.style?.lineWidth ?? DEFAULT_LINE_WIDTH
    this.strokeDashCache = path.style?.strokeDash
    this.selectStyle = path.style?.select
    this.hoverStyle = path.style?.hover
    this.syncLabel(path.label, path.style?.label)
    this.finalizeAngle()
    this.dirty = false
  }

  /**
   * Sync from scene when dirty (no-op when already valid).
   * @param path - live path element, or undefined to clear cache.
   */
  validate(path: GraphPath | undefined): void {
    if (!this.dirty) return
    if (path === undefined) {
      this.pointsCache = []
      this.pathBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.originalBounds = this.pathBounds
      this.pointsBox = this.pathBounds
      this.angleDeg = 0
      this.angleAnchorCache = undefined
      this.labelCache = undefined
      this.labelCenter = undefined
      this.dirty = false
      return
    }
    this.sync(path)
  }

  /**
   * Hit-test densified segments; closed + fill also hits polygon interior.
   */
  hit(worldX: number, worldY: number, threshold: number): boolean {
    if (this.pointsCache.length < 2) return false
    // Authored points stay unrotated; map the pointer into that frame.
    const world = { x: worldX, y: worldY }
    const point = this.angleDeg === 0
      ? world
      : inverseRotatePointAround(world, this.pivot, this.angleDeg)
    if (distanceToPolyline(point, this.pointsCache) <= threshold) return true
    if (this.closed && this.fillCache !== undefined && this.fillCache.length > 0) {
      return pointInPolygon(point, this.pointsCache)
    }
    return false
  }

  /**
   * Build a paint DTO for the renderer.
   * @param selected - selection highlight.
   * @param hovered - hover highlight.
   */
  toPaintView(selected: boolean, hovered: boolean): PathPaintView {
    let resolvedStroke = this.strokeCache
    let paintWidth = this.lineWidthCache
    let paintAlpha = this.alphaCache
    if (hovered && !selected) {
      resolvedStroke = this.hoverStyle?.color ?? DEFAULT_STROKE_HOVER
      paintWidth = Math.max(this.lineWidthCache, this.hoverStyle?.width ?? 2.5)
      if (this.hoverStyle?.padding !== undefined) {
        paintWidth += this.hoverStyle.padding * 2
      }
      if (this.hoverStyle?.alpha !== undefined) {
        paintAlpha = clampAlpha(this.hoverStyle.alpha)
      }
    } else if (selected) {
      resolvedStroke = this.selectStyle?.color ?? DEFAULT_STROKE_HOVER
      paintWidth = Math.max(this.lineWidthCache, this.selectStyle?.width ?? 2.5)
      if (this.selectStyle?.padding !== undefined) {
        paintWidth += this.selectStyle.padding * 2
      }
      if (this.selectStyle?.alpha !== undefined) {
        paintAlpha = clampAlpha(this.selectStyle.alpha)
      }
    }
    return {
      points: this.pointsCache,
      bounds: this.pathBounds,
      selected,
      hovered,
      ...(this.angleDeg !== 0
        ? {
          angle: this.angleDeg,
          ...(this.angleAnchorCache !== undefined ? { angleAnchor: this.angleAnchorCache } : {}),
          anglePivot: this.pivot,
        }
        : {}),
      closed: this.closed,
      alpha: paintAlpha,
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

  /** Split original vs rotated bounds once label union is known. */
  private finalizeAngle(): void {
    this.originalBounds = this.pathBounds
    this.pathBounds = rotatedAabbOfRectAbout(this.originalBounds, this.pivot, this.angleDeg)
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
      resolveMaxChars(style, DEFAULT_PATH_MAX_CHARS),
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
    this.pathBounds = unionRect(this.pathBounds, labelBox) ?? this.pathBounds
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

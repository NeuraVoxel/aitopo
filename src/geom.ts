/**
 * Shared 2D geometry helpers for views and dirty-rect union.
 */

/** World-space point. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Axis-aligned rectangle in world space. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Union two rectangles; either may be undefined.
 * @param a - first rect.
 * @param b - second rect.
 * @returns union, or the defined side, or undefined.
 */
export function unionRect(a: Rect | undefined, b: Rect | undefined): Rect | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * Whether two rectangles intersect (edges touching counts).
 * @param a - first.
 * @param b - second.
 */
export function intersectsRect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x
    || b.x + b.width < a.x
    || a.y + a.height < b.y
    || b.y + b.height < a.y
  )
}

/**
 * Whether `outer` fully contains `inner` (edges touching counts).
 * @param outer - candidate container.
 * @param inner - candidate contained rect.
 */
export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  )
}

/**
 * Whether every rect field is a finite number (rejects NaN / ±Infinity).
 * @param rect - candidate.
 */
export function isFiniteRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
  )
}

/**
 * Point-in-rect test with optional padding.
 * @param point - world point.
 * @param rect - target.
 * @param pad - expansion on each side.
 */
export function hitRect(point: Point, rect: Rect, pad = 0): boolean {
  return point.x >= rect.x - pad
    && point.x <= rect.x + rect.width + pad
    && point.y >= rect.y - pad
    && point.y <= rect.y + rect.height + pad
}

/**
 * Grow a rect by padding on each side.
 * @param rect - input.
 * @param pad - padding.
 */
export function growRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

/** Per-side insets for asymmetric growth (e.g. group title clearance). */
export interface RectInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/**
 * Grow a rect by independent insets on each side.
 * @param rect - input.
 * @param insets - per-side padding.
 */
export function growRectInsets(rect: Rect, insets: RectInsets): Rect {
  return {
    x: rect.x - insets.left,
    y: rect.y - insets.top,
    width: rect.width + insets.left + insets.right,
    height: rect.height + insets.top + insets.bottom,
  }
}

/**
 * Distance from a point to a line segment.
 * @param point - query point.
 * @param a - segment start.
 * @param b - segment end.
 */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

/**
 * Minimum distance from a point to a polyline.
 * @param point - query point.
 * @param points - polyline vertices.
 */
export function distanceToPolyline(point: Point, points: readonly Point[]): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY
  if (points.length === 1) {
    return Math.hypot(point.x - points[0]!.x, point.y - points[0]!.y)
  }
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < points.length - 1; i += 1) {
    best = Math.min(best, distanceToSegment(point, points[i]!, points[i + 1]!))
  }
  return best
}

/** Relative pivot inside an AABB (`u`/`v` in `[0, 1]`). */
export interface AngleAnchor {
  readonly u: number
  readonly v: number
}

/**
 * Normalize degrees into `[0, 360)`.
 * @param angle - raw degrees.
 */
export function normalizeAngleDegrees(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const wrapped = angle % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/**
 * Clamp a number into `[0, 1]`; non-finite → `0.5`.
 * @param value - raw component.
 */
export function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

/**
 * Resolve angle anchor; omitted / partial → center `{ u: 0.5, v: 0.5 }`.
 * @param anchor - optional relative pivot.
 */
export function resolveAngleAnchor(
  anchor?: { readonly u?: number; readonly v?: number },
): AngleAnchor {
  return {
    u: clampUnitInterval(anchor?.u ?? 0.5),
    v: clampUnitInterval(anchor?.v ?? 0.5),
  }
}

/**
 * World pivot for rotation inside `bounds`.
 * @param bounds - original (unrotated) AABB.
 * @param anchor - optional relative pivot.
 */
export function anglePivot(
  bounds: Rect,
  anchor?: { readonly u?: number; readonly v?: number },
): Point {
  const { u, v } = resolveAngleAnchor(anchor)
  return {
    x: bounds.x + u * bounds.width,
    y: bounds.y + v * bounds.height,
  }
}

/**
 * Rotate a point about a pivot by degrees (canvas y-down, positive = clockwise).
 * @param point - world point.
 * @param pivot - rotation center.
 * @param angleDeg - degrees.
 */
export function rotatePointAround(point: Point, pivot: Point, angleDeg: number): Point {
  const angle = normalizeAngleDegrees(angleDeg)
  if (angle === 0) return point
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  }
}

/**
 * Inverse of {@link rotatePointAround} (rotate by `-angleDeg`).
 * @param point - world point.
 * @param pivot - rotation center.
 * @param angleDeg - forward degrees used when painting.
 */
export function inverseRotatePointAround(
  point: Point,
  pivot: Point,
  angleDeg: number,
): Point {
  return rotatePointAround(point, pivot, -normalizeAngleDegrees(angleDeg))
}

/**
 * Axis-aligned bounds of a rect after rotation about its angle anchor.
 * @param bounds - original AABB.
 * @param angleDeg - degrees.
 * @param anchor - optional relative pivot.
 */
export function rotatedAabbFromRect(
  bounds: Rect,
  angleDeg: number,
  anchor?: { readonly u?: number; readonly v?: number },
): Rect {
  const angle = normalizeAngleDegrees(angleDeg)
  if (angle === 0) return bounds
  const pivot = anglePivot(bounds, anchor)
  const corners: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const corner of corners) {
    const p = rotatePointAround(corner, pivot, angle)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Axis-aligned bounds of points after rotation about a pivot.
 * @param points - world points.
 * @param pivot - rotation center.
 * @param angleDeg - degrees.
 */
export function rotatedAabbFromPoints(
  points: readonly Point[],
  pivot: Point,
  angleDeg: number,
): Rect | undefined {
  if (points.length === 0) return undefined
  const angle = normalizeAngleDegrees(angleDeg)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    const p = angle === 0 ? point : rotatePointAround(point, pivot, angle)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Apply canvas rotation about a pivot (twaver `Util.rotateCanvas` idea; custom pivot).
 * @param ctx - canvas context already in world space.
 * @param pivot - rotation center.
 * @param angleDeg - degrees.
 */
export function rotateCanvasAbout(
  ctx: CanvasRenderingContext2D,
  pivot: Point,
  angleDeg: number,
): void {
  const angle = normalizeAngleDegrees(angleDeg)
  if (angle === 0) return
  ctx.translate(pivot.x, pivot.y)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.translate(-pivot.x, -pivot.y)
}

/**
 * Axis-aligned bounds of a rect after rotation about an explicit pivot.
 * Use when the pivot comes from a different box (e.g. body pivot, union rect).
 * @param rect - original AABB to rotate.
 * @param pivot - rotation center.
 * @param angleDeg - degrees.
 */
export function rotatedAabbOfRectAbout(rect: Rect, pivot: Point, angleDeg: number): Rect {
  if (normalizeAngleDegrees(angleDeg) === 0) return rect
  const aabb = rotatedAabbFromPoints(
    [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ],
    pivot,
    angleDeg,
  )
  return aabb ?? rect
}

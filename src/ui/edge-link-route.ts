/**
 * Clean-room edge path builders inspired by twaver link.type geometries.
 * No twaver imports or public API names.
 */

import type { Point, Rect } from '../geom.ts'
import type {
  EdgeLoopedDirection,
  EdgeLoopedType,
  EdgeRoute,
  EdgeShapeKind,
} from '../protocol/types.ts'
import { orthogonalHV, orthogonalVH } from './bounds.ts'
import { straightRoute } from './edge-route.ts'
import { densifyControlPolyline } from './path-route.ts'

export const DEFAULT_ROUTE_EXTEND = 20
export const DEFAULT_BUNDLE_GAP = 12
export const DEFAULT_BUNDLE_OFFSET = 20
export const DEFAULT_LOOPED_GAP = 6

export interface BoxPairRouteInput {
  readonly fromBox: Rect
  readonly toBox: Rect
  readonly route: EdgeRoute
  readonly routeExtend?: number
  readonly routeOffset?: number
  readonly bundleOffset?: number
}

/** True when route is resolved from endpoint AABBs (not ring arc / shape / straight chord). */
export function isBoxPairRoute(route: EdgeRoute): boolean {
  return route === 'orthogonal'
    || route === 'orthogonalHV'
    || route === 'orthogonalVH'
    || route === 'orthogonalHorizontal'
    || route === 'orthogonalVertical'
    || route === 'flexional'
    || route === 'flexionalHorizontal'
    || route === 'flexionalVertical'
    || route === 'extendTop'
    || route === 'extendLeft'
    || route === 'extendBottom'
    || route === 'extendRight'
}

/** Chord-bulge family (twaver arc / triangle / parallel ideas). */
export function isBundleShapeRoute(route: EdgeRoute): boolean {
  return route === 'bundleArc' || route === 'triangle' || route === 'parallel'
}

/**
 * Build polyline for box-pair routes (flexional / extend / ortho variants).
 * Endpoints are rectangle-perimeter pins toward the next interior point.
 */
export function buildBoxPairRoute(input: BoxPairRouteInput): Point[] {
  const extend = input.routeExtend ?? DEFAULT_ROUTE_EXTEND
  const route = input.route
  const source = input.fromBox
  const target = input.toBox

  if (route === 'orthogonalHV') {
    const full = orthogonalHV(boxCenter(source), boxCenter(target))
    return pinEnds(source, target, full.slice(1, -1))
  }
  if (route === 'orthogonalVH') {
    const full = orthogonalVH(boxCenter(source), boxCenter(target))
    return pinEnds(source, target, full.slice(1, -1))
  }
  if (route === 'orthogonalHorizontal') {
    return pinEnds(source, target, sideCorridor(source, target, true, extend))
  }
  if (route === 'orthogonalVertical') {
    return pinEnds(source, target, sideCorridor(source, target, false, extend))
  }
  if (route === 'orthogonal') {
    // Prefer H corridor when x-gap dominates (twaver isHorizontal idea).
    const horizontal = xGap(source, target) >= yGap(source, target)
    return pinEnds(source, target, sideCorridor(source, target, horizontal, extend))
  }
  if (route === 'flexional' || route === 'flexionalHorizontal' || route === 'flexionalVertical') {
    const horizontal = route === 'flexional'
      ? xGap(source, target) >= yGap(source, target)
      : route === 'flexionalHorizontal'
    const mid = horizontal
      ? flexionalHorizontal(source, target, extend)
      : flexionalVertical(source, target, extend)
    return pinEnds(source, target, mid)
  }
  if (
    route === 'extendTop'
    || route === 'extendLeft'
    || route === 'extendBottom'
    || route === 'extendRight'
  ) {
    return pinEnds(source, target, extendRoute(source, target, route, extend))
  }
  return pinEnds(source, target, orthogonalHV(boxCenter(source), boxCenter(target)))
}

/**
 * Chord bulge for bundleArc / triangle / parallel.
 * `yOffset` is perpendicular offset (bundle fan + routeOffset).
 */
export function buildBundleShapeRoute(
  from: Point,
  to: Point,
  route: 'bundleArc' | 'triangle' | 'parallel',
  yOffset: number,
  bundleOffset = DEFAULT_BUNDLE_OFFSET,
): Point[] {
  if (route !== 'parallel' && Math.abs(yOffset) < 1e-9) {
    return straightRoute(from, to)
  }
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  if (dist < 1e-9) return [from, to]
  const inset = Math.min(bundleOffset, dist / 2)
  const local: Point[] = []
  if (route === 'bundleArc' || route === 'triangle') {
    local.push({ x: 0, y: 0 })
  }
  if (route === 'bundleArc') {
    local.push({ x: 0, y: yOffset })
  }
  local.push({ x: inset, y: yOffset })
  local.push({ x: dist - inset, y: yOffset })
  if (route === 'bundleArc') {
    local.push({ x: dist, y: yOffset })
  }
  if (route === 'bundleArc' || route === 'triangle') {
    local.push({ x: dist, y: 0 })
  }
  if (route === 'parallel') {
    // Already have the two offset points; endpoints sit on the offset line ends.
  }
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const mapped = local.map(p => ({
    x: from.x + p.x * cos - p.y * sin,
    y: from.y + p.x * sin + p.y * cos,
  }))
  if (route === 'parallel') {
    return [
      { x: from.x - yOffset * sin, y: from.y + yOffset * cos },
      ...mapped,
      { x: to.x - yOffset * sin, y: to.y + yOffset * cos },
    ]
  }
  // bundleArc: densify quadratic-like elbows at the two outer control pairs.
  if (route === 'bundleArc' && mapped.length >= 6) {
    return densifyBundleArc(mapped)
  }
  return mapped
}

/** Self-loop path around a single box. */
export function buildLoopedRoute(
  box: Rect,
  type: EdgeLoopedType = 'arc',
  direction: EdgeLoopedDirection = 'northwest',
  gap = DEFAULT_LOOPED_GAP,
): Point[] {
  const radius = Math.max(box.width, box.height) / 2 + gap * 4
  const percentRadius = radius * 0.5
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  if (type === 'arc') {
    return sampleLoopedArc(box, direction, radius)
  }
  // rectangle loops — cardinal / diagonal stubs (twaver rectangle ideas).
  switch (direction) {
    case 'north':
      return [
        { x: cx - percentRadius, y: box.y },
        { x: cx - percentRadius, y: box.y - radius },
        { x: cx + percentRadius, y: box.y - radius },
        { x: cx + percentRadius, y: box.y },
      ]
    case 'south':
      return [
        { x: cx - percentRadius, y: box.y + box.height },
        { x: cx - percentRadius, y: box.y + box.height + radius },
        { x: cx + percentRadius, y: box.y + box.height + radius },
        { x: cx + percentRadius, y: box.y + box.height },
      ]
    case 'east':
      return [
        { x: box.x + box.width, y: cy - percentRadius },
        { x: box.x + box.width + radius, y: cy - percentRadius },
        { x: box.x + box.width + radius, y: cy + percentRadius },
        { x: box.x + box.width, y: cy + percentRadius },
      ]
    case 'west':
      return [
        { x: box.x, y: cy - percentRadius },
        { x: box.x - radius, y: cy - percentRadius },
        { x: box.x - radius, y: cy + percentRadius },
        { x: box.x, y: cy + percentRadius },
      ]
    case 'northeast':
      return rectCornerLoop(box.x + box.width, box.y, percentRadius, radius, 1, -1)
    case 'northwest':
      return rectCornerLoop(box.x, box.y, percentRadius, radius, -1, -1)
    case 'southeast':
      return rectCornerLoop(box.x + box.width, box.y + box.height, percentRadius, radius, 1, 1)
    case 'southwest':
      return rectCornerLoop(box.x, box.y + box.height, percentRadius, radius, -1, 1)
  }
}

/** ShapeLink: from + shapePoints + to with segment kind densify. */
export function buildShapeRoute(
  from: Point,
  to: Point,
  shapePoints: readonly Point[],
  kind: EdgeShapeKind = 'lineto',
): Point[] {
  const raw = [from, ...shapePoints, to]
  if (kind === 'orthogonalto') {
    const out: Point[] = [raw[0]!]
    let last = raw[0]!
    for (let i = 1; i < raw.length; i += 1) {
      const p = raw[i]!
      if (i < raw.length - 1) {
        const dx = p.x - last.x
        const dy = p.y - last.y
        const next = Math.abs(dx) > Math.abs(dy)
          ? { x: p.x, y: last.y }
          : { x: last.x, y: p.y }
        out.push(next)
        last = next
      } else {
        out.push(p)
      }
    }
    return out
  }
  return densifyControlPolyline(raw, kind)
}

/**
 * Sibling fan offset for same directed endpoint pair.
 * Index 0..n-1 → centered offsets using gap.
 */
export function bundleFanOffset(
  index: number,
  count: number,
  gap: number,
): number {
  if (count <= 1) return 0
  const mid = (count - 1) / 2
  return (index - mid) * gap
}

function densifyBundleArc(mapped: Point[]): Point[] {
  // mapped layout mirrors twaver: p0 start, p1 outer, p2/p3 mid offset, p4 outer, p5 end
  // Use polyline through control points (paint may round corners).
  return mapped
}

function sampleLoopedArc(box: Rect, direction: EdgeLoopedDirection, radius: number): Point[] {
  const steps = 16
  let cx: number
  let cy: number
  let start: number
  let sweep: number
  switch (direction) {
    case 'north':
      cx = box.x + box.width / 2
      cy = box.y
      start = Math.PI
      sweep = Math.PI
      break
    case 'south':
      cx = box.x + box.width / 2
      cy = box.y + box.height
      start = 0
      sweep = Math.PI
      break
    case 'east':
      cx = box.x + box.width
      cy = box.y + box.height / 2
      start = -Math.PI / 2
      sweep = Math.PI
      break
    case 'west':
      cx = box.x
      cy = box.y + box.height / 2
      start = Math.PI / 2
      sweep = Math.PI
      break
    case 'northeast':
      cx = box.x + box.width
      cy = box.y
      start = Math.PI
      sweep = Math.PI * 1.5
      break
    case 'northwest':
      cx = box.x
      cy = box.y
      start = 0
      sweep = Math.PI * 1.5
      break
    case 'southeast':
      cx = box.x + box.width
      cy = box.y + box.height
      start = -Math.PI / 2
      sweep = Math.PI * 1.5
      break
    case 'southwest':
      cx = box.x
      cy = box.y + box.height
      start = Math.PI / 2
      sweep = Math.PI * 1.5
      break
  }
  const out: Point[] = []
  for (let i = 0; i <= steps; i += 1) {
    const a = start + (sweep * i) / steps
    out.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius })
  }
  return out
}

function rectCornerLoop(
  ox: number,
  oy: number,
  percentRadius: number,
  radius: number,
  sx: number,
  sy: number,
): Point[] {
  return [
    { x: ox, y: oy + percentRadius * -sy },
    { x: ox + percentRadius * sx, y: oy + percentRadius * -sy },
    { x: ox + percentRadius * sx, y: oy + radius * sy },
    { x: ox + percentRadius * -sx, y: oy + radius * sy },
    { x: ox + percentRadius * -sx, y: oy },
  ]
}

function flexionalHorizontal(source: Rect, target: Rect, segment: number): Point[] {
  const isSourceLeft = target.x + target.width < source.x
  const isTargetLeft = source.x + source.width < target.x
  const x0 = isSourceLeft ? source.x : source.x + source.width
  const y0 = source.y + source.height / 2
  const xe = isTargetLeft ? target.x : target.x + target.width
  const ye = target.y + target.height / 2
  const dep = { x: x0 + (isSourceLeft ? -segment : segment), y: y0 }
  const arr = { x: xe + (isTargetLeft ? -segment : segment), y: ye }
  if (isSourceLeft === isTargetLeft) {
    const x = isSourceLeft ? Math.min(x0, xe) - segment : Math.max(x0, xe) + segment
    return [{ x, y: y0 }, { x, y: ye }]
  }
  if ((dep.x < arr.x) === isSourceLeft) {
    const midY = y0 + (ye - y0) / 2
    return [dep, { x: dep.x, y: midY }, { x: arr.x, y: midY }, arr]
  }
  return [dep, arr]
}

function flexionalVertical(source: Rect, target: Rect, segment: number): Point[] {
  const isSourceTop = target.y + target.height < source.y
  const isTargetTop = source.y + source.height < target.y
  const x0 = source.x + source.width / 2
  const y0 = isSourceTop ? source.y : source.y + source.height
  const xe = target.x + target.width / 2
  const ye = isTargetTop ? target.y : target.y + target.height
  const dep = { x: x0, y: y0 + (isSourceTop ? -segment : segment) }
  const arr = { x: xe, y: ye + (isTargetTop ? -segment : segment) }
  if (isSourceTop === isTargetTop) {
    const y = isSourceTop ? Math.min(y0, ye) - segment : Math.max(y0, ye) + segment
    return [{ x: x0, y }, { x: xe, y }]
  }
  if ((dep.y < arr.y) === isSourceTop) {
    const midX = x0 + (xe - x0) / 2
    return [dep, { x: midX, y: dep.y }, { x: midX, y: arr.y }, arr]
  }
  return [dep, arr]
}

function extendRoute(
  source: Rect,
  target: Rect,
  route: 'extendTop' | 'extendLeft' | 'extendBottom' | 'extendRight',
  extend: number,
): Point[] {
  const top = Math.min(source.y, target.y)
  const left = Math.min(source.x, target.x)
  const bottom = Math.max(source.y + source.height, target.y + target.height)
  const right = Math.max(source.x + source.width, target.x + target.width)
  const sx = source.x + source.width / 2
  const sy = source.y + source.height / 2
  const tx = target.x + target.width / 2
  const ty = target.y + target.height / 2
  if (route === 'extendTop') {
    const y = top - extend
    return [{ x: sx, y }, { x: tx, y }]
  }
  if (route === 'extendBottom') {
    const y = bottom + extend
    return [{ x: sx, y }, { x: tx, y }]
  }
  if (route === 'extendLeft') {
    const x = left - extend
    return [{ x, y: sy }, { x, y: ty }]
  }
  const x = right + extend
  return [{ x, y: sy }, { x, y: ty }]
}

function sideCorridor(
  source: Rect,
  target: Rect,
  horizontal: boolean,
  _extend: number,
): Point[] {
  const sc = boxCenter(source)
  const tc = boxCenter(target)
  if (horizontal) {
    const x = (sc.x + tc.x) / 2
    return [{ x, y: sc.y }, { x, y: tc.y }]
  }
  const y = (sc.y + tc.y) / 2
  return [{ x: sc.x, y }, { x: tc.x, y }]
}

function pinEnds(source: Rect, target: Rect, mid: Point[]): Point[] {
  if (mid.length === 0) {
    const next = boxCenter(target)
    const from = rectanglePerimeter(source, next)
    const to = rectanglePerimeter(target, from)
    return [from, to]
  }
  const from = rectanglePerimeter(source, mid[0]!)
  const to = rectanglePerimeter(target, mid[mid.length - 1]!)
  return dedupePoints([from, ...mid, to])
}

function rectanglePerimeter(bounds: Rect, next: Point): Point {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const dx = next.x - cx
  const dy = next.y - cy
  const alpha = Math.atan2(dy, dx)
  const pi = Math.PI
  const pi2 = Math.PI / 2
  const beta = pi2 - alpha
  const t = Math.atan2(bounds.height, bounds.width)
  const p = { x: 0, y: 0 }
  if (alpha < -pi + t || alpha > pi - t) {
    p.x = bounds.x
    p.y = cy - (bounds.width * Math.tan(alpha)) / 2
  } else if (alpha < -t) {
    p.y = bounds.y
    p.x = cx - (bounds.height * Math.tan(beta)) / 2
  } else if (alpha < t) {
    p.x = bounds.x + bounds.width
    p.y = cy + (bounds.width * Math.tan(alpha)) / 2
  } else {
    p.y = bounds.y + bounds.height
    p.x = cx + (bounds.height * Math.tan(beta)) / 2
  }
  if (next.x >= bounds.x && next.x <= bounds.x + bounds.width) p.x = next.x
  else if (next.y >= bounds.y && next.y <= bounds.y + bounds.height) p.y = next.y
  p.x = Math.min(bounds.x + bounds.width, Math.max(bounds.x, p.x))
  p.y = Math.min(bounds.y + bounds.height, Math.max(bounds.y, p.y))
  return p
}

function dedupePoints(points: Point[]): Point[] {
  if (points.length < 2) return points
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]!
    const prev = out[out.length - 1]!
    if (Math.abs(p.x - prev.x) < 1e-6 && Math.abs(p.y - prev.y) < 1e-6) continue
    out.push(p)
  }
  return out
}

function boxCenter(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function xGap(a: Rect, b: Rect): number {
  return Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x) - a.width - b.width
}

function yGap(a: Rect, b: Rect): number {
  return Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) - a.height - b.height
}

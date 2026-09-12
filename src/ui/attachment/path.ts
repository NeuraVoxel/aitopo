/**
 * Sample points along an edge polyline for attachment / arrow placement.
 */

import type { Point, Rect } from '../../geom.ts'

const DEFAULT_NORMAL_GAP = 8

/**
 * Point and unit tangent at arc-length ratio `t` along a polyline.
 * Degenerate paths clamp to the first or last vertex with a fallback tangent.
 * @param points - polyline including endpoints.
 * @param t - ratio in `[0, 1]` (clamped).
 */
export function samplePolylineAt(
  points: readonly Point[],
  t: number,
): { readonly point: Point; readonly tangent: Point } {
  if (points.length === 0) {
    return { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } }
  }
  if (points.length === 1) {
    return { point: { ...points[0]! }, tangent: { x: 1, y: 0 } }
  }
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    lengths.push(len)
    total += len
  }
  if (total <= 1e-9) {
    const a = points[0]!
    const b = points[points.length - 1]!
    return {
      point: { ...a },
      tangent: unitOrFallback(b.x - a.x, b.y - a.y),
    }
  }
  const target = clamped * total
  let walked = 0
  for (let i = 0; i < lengths.length; i += 1) {
    const segLen = lengths[i]!
    const a = points[i]!
    const b = points[i + 1]!
    if (walked + segLen >= target || i === lengths.length - 1) {
      const local = segLen <= 1e-9 ? 0 : (target - walked) / segLen
      const u = Math.min(1, Math.max(0, local))
      return {
        point: {
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u,
        },
        tangent: unitOrFallback(b.x - a.x, b.y - a.y),
      }
    }
    walked += segLen
  }
  const last = points[points.length - 1]!
  const prev = points[points.length - 2]!
  return {
    point: { ...last },
    tangent: unitOrFallback(last.x - prev.x, last.y - prev.y),
  }
}

/**
 * Axis-aligned content box centered on a path sample, offset along the normal.
 * @param points - edge polyline.
 * @param at - arc-length ratio.
 * @param width - content width.
 * @param height - content height.
 * @param normalGap - distance from the path along the left normal.
 */
export function placeAlongPath(
  points: readonly Point[],
  at: number,
  width: number,
  height: number,
  normalGap = DEFAULT_NORMAL_GAP,
): Rect {
  const { point, tangent } = samplePolylineAt(points, at)
  const nx = -tangent.y
  const ny = tangent.x
  const cx = point.x + nx * normalGap
  const cy = point.y + ny * normalGap
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  }
}

function unitOrFallback(dx: number, dy: number): Point {
  const len = Math.hypot(dx, dy)
  if (len <= 1e-9) return { x: 1, y: 0 }
  return { x: dx / len, y: dy / len }
}

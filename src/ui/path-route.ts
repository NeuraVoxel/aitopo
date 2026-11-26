/**
 * Freestanding path densify (control polyline → paint/hit polyline).
 * Shared sampling with edge shape routes (no from/to injection).
 */

import type { Point } from '../geom.ts'
import type { PathShapeKind } from '../protocol/types.ts'

/**
 * Densify a control polyline with shape segment kind.
 * Points are the full control list (no endpoint injection).
 */
export function densifyControlPolyline(
  points: readonly Point[],
  kind: PathShapeKind = 'lineto',
): Point[] {
  if (points.length === 0) return []
  if (kind === 'lineto') {
    return points.map(p => ({ x: p.x, y: p.y }))
  }
  if (kind === 'quadto') {
    const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }]
    for (let i = 1; i < points.length; i += 1) {
      if (i < points.length - 1) {
        const c = points[i]!
        const end = points[i + 1]!
        out.push(...sampleQuad(out[out.length - 1]!, c, end))
        i += 1
      } else {
        out.push({ x: points[i]!.x, y: points[i]!.y })
      }
    }
    return out
  }
  // cubicto
  const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }]
  for (let i = 1; i < points.length; i += 1) {
    if (i < points.length - 2) {
      const c1 = points[i]!
      const c2 = points[i + 1]!
      const end = points[i + 2]!
      out.push(...sampleCubic(out[out.length - 1]!, c1, c2, end))
      i += 2
    } else if (i < points.length - 1) {
      const c = points[i]!
      const end = points[i + 1]!
      out.push(...sampleQuad(out[out.length - 1]!, c, end))
      i += 1
    } else {
      out.push({ x: points[i]!.x, y: points[i]!.y })
    }
  }
  return out
}

/**
 * Densify path control points for paint/hit.
 * When `closed`, ensures last vertex equals first for stroke close / fill.
 */
export function buildPathPolyline(
  points: readonly Point[],
  kind: PathShapeKind = 'lineto',
  closed = false,
): Point[] {
  const densified = densifyControlPolyline(points, kind)
  if (!closed || densified.length === 0) return densified
  const first = densified[0]!
  const last = densified[densified.length - 1]!
  if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) {
    return densified
  }
  return [...densified, { x: first.x, y: first.y }]
}

/** Quadratic Bezier samples (excludes t=0; includes t=1). */
export function sampleQuad(p0: Point, p1: Point, p2: Point, steps = 8): Point[] {
  const out: Point[] = []
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const u = 1 - t
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    })
  }
  return out
}

/** Cubic Bezier samples (excludes t=0; includes t=1). */
export function sampleCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 12,
): Point[] {
  const out: Point[] = []
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const u = 1 - t
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    })
  }
  return out
}

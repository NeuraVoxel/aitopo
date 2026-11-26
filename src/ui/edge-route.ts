/**
 * Non-orthogonal edge routes (circular arc / straight).
 * Clean-room: twaver `link.type: arc` is a bundle bulge; ring diagrams need a
 * shared-center circular arc between endpoint anchors instead.
 */

import type { Point } from '../geom.ts'

const TWO_PI = Math.PI * 2
/** ~one sample every 6° for hit / labels / arrows. */
const SAMPLE_STEP = Math.PI / 30

/** Paint descriptor for a true canvas circular arc. */
export interface CircularArcDraw {
  readonly center: Point
  readonly radius: number
  readonly startAngle: number
  readonly endAngle: number
  /** Screen-space clockwise (canvas y-down + atan2). */
  readonly clockwise: boolean
}

export interface CircularArcRoute {
  readonly points: readonly Point[]
  readonly draw: CircularArcDraw
}

/**
 * Build a circular arc around `center`.
 * Endpoints are **projected onto** the circle (fixed `radius`, or mean of
 * endpoint distances) so the stroke is a true ring segment — not a chord
 * between off-circle box anchors.
 */
export function buildCircularArc(
  center: Point,
  from: Point,
  to: Point,
  clockwise = true,
  radius?: number,
): CircularArcRoute {
  const r0 = Math.hypot(from.x - center.x, from.y - center.y)
  const r1 = Math.hypot(to.x - center.x, to.y - center.y)
  const R = Math.max(1, radius ?? (r0 + r1) / 2)
  let a0 = Math.atan2(from.y - center.y, from.x - center.x)
  let a1 = Math.atan2(to.y - center.y, to.x - center.x)
  let sweep = a1 - a0
  if (clockwise) {
    while (sweep <= 0) sweep += TWO_PI
  } else {
    while (sweep >= 0) sweep -= TWO_PI
  }
  // Paint end = start + sweep so canvas does not cross the ±π branch the long way.
  const endAngle = a0 + sweep
  if (Math.abs(sweep) < 1e-6 || Math.abs(sweep) > TWO_PI - 1e-6) {
    const p0 = polar(center, R, a0)
    const p1 = polar(center, R, a1)
    return {
      points: [p0, p1],
      draw: {
        center,
        radius: R,
        startAngle: a0,
        endAngle,
        clockwise,
      },
    }
  }
  const start = polar(center, R, a0)
  const end = polar(center, R, a1)
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / SAMPLE_STEP))
  const points: Point[] = [start]
  for (let i = 1; i < steps; i += 1) {
    const a = a0 + sweep * (i / steps)
    points.push(polar(center, R, a))
  }
  points.push(end)
  return {
    points,
    draw: {
      center,
      radius: R,
      startAngle: a0,
      endAngle,
      clockwise,
    },
  }
}

/** @deprecated use {@link buildCircularArc} */
export function sampleCircularArc(
  center: Point,
  from: Point,
  to: Point,
  clockwise = true,
  radius?: number,
): Point[] {
  return [...buildCircularArc(center, from, to, clockwise, radius).points]
}

/**
 * Axis-free straight segment (radial spokes, etc.).
 */
export function straightRoute(from: Point, to: Point): Point[] {
  return [from, to]
}

function polar(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  }
}

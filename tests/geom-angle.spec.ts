import { describe, expect, it } from 'vitest'
import {
  anglePivot,
  inverseRotatePointAround,
  normalizeAngleDegrees,
  resolveAngleAnchor,
  rotatedAabbFromRect,
  rotatePointAround,
} from '../src/geom.ts'

describe('angle geom helpers', () => {
  it('normalizes degrees into [0, 360)', () => {
    expect(normalizeAngleDegrees(0)).toBe(0)
    expect(normalizeAngleDegrees(360)).toBe(0)
    expect(normalizeAngleDegrees(-90)).toBe(270)
    expect(normalizeAngleDegrees(450)).toBe(90)
  })

  it('defaults angleAnchor to center and clamps u/v', () => {
    expect(resolveAngleAnchor()).toEqual({ u: 0.5, v: 0.5 })
    expect(resolveAngleAnchor({ u: -1, v: 2 })).toEqual({ u: 0, v: 1 })
  })

  it('pivots and rotates a rect AABB', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 40 }
    expect(anglePivot(bounds)).toEqual({ x: 50, y: 20 })
    expect(anglePivot(bounds, { u: 0, v: 0 })).toEqual({ x: 0, y: 0 })
    const rotated = rotatedAabbFromRect(bounds, 90)
    expect(rotated.width).toBeCloseTo(40, 5)
    expect(rotated.height).toBeCloseTo(100, 5)
  })

  it('inverse-rotates back to the original point', () => {
    const pivot = { x: 10, y: 20 }
    const point = { x: 30, y: 20 }
    const spun = rotatePointAround(point, pivot, 45)
    const back = inverseRotatePointAround(spun, pivot, 45)
    expect(back.x).toBeCloseTo(point.x, 8)
    expect(back.y).toBeCloseTo(point.y, 8)
  })
})

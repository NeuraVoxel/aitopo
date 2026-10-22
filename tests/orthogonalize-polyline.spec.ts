/**
 * orthogonalizePolyline keeps corridors while forcing 横平竖直.
 */

import { describe, expect, it } from 'vitest'
import { edgeAnchorsFromRects, orthogonalizePolyline } from '../src/ui/bounds.ts'

describe('orthogonalizePolyline', () => {
  it('leaves an already orthogonal path unchanged', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ]
    expect(orthogonalizePolyline(pts)).toEqual(pts)
  })

  it('inserts an elbow for a diagonal segment', () => {
    const pts = orthogonalizePolyline([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ])
    expect(pts.length).toBeGreaterThan(2)
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!
      const b = pts[i]!
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
  })

  it('orthogonalizes remapped corridor endpoints via edgeAnchorsFromRects', () => {
    // Collapsed band at (100,100)-(220,164); corridor at y=300 aimed at expanded member.
    const route = edgeAnchorsFromRects(
      { x: 400, y: 200, width: 50, height: 50 },
      { x: 100, y: 100, width: 120, height: 64 },
      [{ x: 300, y: 300 }, { x: 180, y: 300 }],
      { from: 'left', to: 'right' },
    )
    expect(route.points.some(p => p.y === 300)).toBe(true)
    for (let i = 1; i < route.points.length; i += 1) {
      const a = route.points[i - 1]!
      const b = route.points[i]!
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
  })
})

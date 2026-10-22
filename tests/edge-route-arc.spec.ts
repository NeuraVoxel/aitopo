/**
 * Edge route modes: circular arc + straight (ring / spoke layouts).
 */

import { describe, expect, it } from 'vitest'
import { buildCircularArc, straightRoute } from '../src/ui/edge-route.ts'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('buildCircularArc', () => {
  const center = { x: 560, y: 360 }

  it('projects endpoints onto a fixed radius', () => {
    const from = { x: 636, y: 80 }
    const to = { x: 756, y: 132 }
    const { points, draw } = buildCircularArc(center, from, to, true, 280)
    expect(draw.radius).toBe(280)
    const r0 = Math.hypot(points[0]!.x - center.x, points[0]!.y - center.y)
    const r1 = Math.hypot(
      points[points.length - 1]!.x - center.x,
      points[points.length - 1]!.y - center.y,
    )
    expect(r0).toBeCloseTo(280, 5)
    expect(r1).toBeCloseTo(280, 5)
    // Off-circle box anchors must not remain as endpoints.
    expect(points[0]).not.toEqual(from)
  })

  it('keeps all samples on the circle', () => {
    const { points } = buildCircularArc(
      center,
      { x: 560, y: 80 },
      { x: 840, y: 360 },
      true,
      280,
    )
    for (const p of points) {
      const r = Math.hypot(p.x - center.x, p.y - center.y)
      expect(r).toBeCloseTo(280, 5)
    }
  })
})

describe('straightRoute', () => {
  it('returns the chord', () => {
    expect(straightRoute({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ])
  })
})

describe('EdgeView route modes', () => {
  it('rejects arc without arcCenter at parse', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 0, y: 0, w: 40, h: 40 },
        { id: 'b', type: 'component', label: 'B', x: 100, y: 0, w: 40, h: 40 },
      ],
      edges: [{
        id: 'e',
        from: 'a',
        to: 'b',
        style: { route: 'arc' },
      }],
    })).toThrow(/arcCenter/)
  })

  it('exposes arc paint descriptor with fixed radius', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 484, y: 48, w: 152, h: 64 },
        { id: 'b', type: 'component', label: 'B', x: 680, y: 132, w: 152, h: 64 },
      ],
      edges: [{
        id: 'e',
        from: 'a',
        to: 'b',
        fromAnchor: 'right',
        toAnchor: 'top',
        style: {
          route: 'arc',
          arcCenter: { x: 560, y: 360 },
          arcRadius: 280,
          arcClockwise: true,
        },
      }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const paint = views.getEdge('e')!.toPaintView(false, false)
    expect(paint.arc).toBeDefined()
    expect(paint.arc!.radius).toBe(280)
    const pts = views.getEdge('e')!.points
    expect(pts.length).toBeGreaterThan(3)
    for (const p of pts) {
      expect(Math.hypot(p.x - 560, p.y - 360)).toBeCloseTo(280, 4)
    }
  })

  it('keeps a diagonal chord for route straight', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 288, y: 132, w: 152, h: 64 },
        { id: 'hub', type: 'component', label: 'H', x: 462, y: 312, w: 196, h: 96 },
      ],
      edges: [{
        id: 's',
        from: 'a',
        to: 'hub',
        fromAnchor: 'bottom',
        toAnchor: 'left',
        style: { route: 'straight' },
      }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getEdge('s')!.points).toHaveLength(2)
    expect(views.getEdge('s')!.toPaintView(false, false).arc).toBeUndefined()
  })
})

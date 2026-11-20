/**
 * Expanded edge routes / loop / shape / bundle fan (twaver-inspired, clean-room).
 */

import { describe, expect, it } from 'vitest'
import {
  buildBoxPairRoute,
  buildBundleShapeRoute,
  buildLoopedRoute,
  buildShapeRoute,
  bundleFanOffset,
} from '../src/ui/edge-link-route.ts'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'
import { parseDocument } from '../src/protocol/parse.ts'

const fromBox = { x: 0, y: 0, width: 40, height: 40 }
const toBox = { x: 120, y: 20, width: 40, height: 40 }

describe('buildBoxPairRoute', () => {
  it('builds flexionalHorizontal with stub outs', () => {
    const pts = buildBoxPairRoute({
      fromBox,
      toBox,
      route: 'flexionalHorizontal',
      routeExtend: 20,
    })
    expect(pts.length).toBeGreaterThanOrEqual(2)
    expect(pts[0]!.x).toBeLessThanOrEqual(fromBox.x + fromBox.width + 0.01)
  })

  it('builds extendTop above both boxes', () => {
    const pts = buildBoxPairRoute({
      fromBox,
      toBox,
      route: 'extendTop',
      routeExtend: 24,
    })
    const minY = Math.min(...pts.map(p => p.y))
    expect(minY).toBeLessThan(Math.min(fromBox.y, toBox.y))
  })

  it('builds orthogonalHV corridor', () => {
    const pts = buildBoxPairRoute({
      fromBox,
      toBox: { x: 120, y: 80, width: 40, height: 40 },
      route: 'orthogonalHV',
    })
    expect(pts.length).toBeGreaterThanOrEqual(3)
  })
})

describe('buildBundleShapeRoute', () => {
  it('returns a straight chord when offset is 0 for bundleArc', () => {
    expect(
      buildBundleShapeRoute({ x: 0, y: 0 }, { x: 100, y: 0 }, 'bundleArc', 0),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
  })

  it('bulges triangle away from the chord', () => {
    const pts = buildBundleShapeRoute(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      'triangle',
      30,
      20,
    )
    expect(pts.some(p => Math.abs(p.y) > 1)).toBe(true)
  })
})

describe('buildLoopedRoute', () => {
  it('returns an open loop with multiple samples', () => {
    const pts = buildLoopedRoute(fromBox, 'arc', 'northwest', 6)
    expect(pts.length).toBeGreaterThan(4)
  })

  it('builds a rectangle loop to the east', () => {
    const pts = buildLoopedRoute(fromBox, 'rectangle', 'east', 6)
    expect(pts.length).toBe(4)
    expect(pts.every(p => p.x >= fromBox.x + fromBox.width - 0.01)).toBe(true)
  })
})

describe('buildShapeRoute', () => {
  it('densifies quadto controls', () => {
    const pts = buildShapeRoute(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      [
        { x: 30, y: -40 },
        { x: 70, y: 40 },
      ],
      'quadto',
    )
    expect(pts.length).toBeGreaterThan(3)
  })
})

describe('bundleFanOffset', () => {
  it('centers three siblings', () => {
    expect(bundleFanOffset(0, 3, 12)).toBe(-12)
    expect(bundleFanOffset(1, 3, 12)).toBe(0)
    expect(bundleFanOffset(2, 3, 12)).toBe(12)
  })
})

describe('parse + EdgeView link styles', () => {
  it('rejects shape without shapePoints', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'component', label: 'B', x: 100, y: 0 },
      ],
      edges: [{
        id: 'e',
        from: 'a',
        to: 'b',
        style: { route: 'shape' },
      }],
    })).toThrow(/shapePoints/)
  })

  it('exposes flexional and looped polylines', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 0, y: 0, w: 40, h: 40 },
        { id: 'b', type: 'component', label: 'B', x: 140, y: 30, w: 40, h: 40 },
        { id: 'c', type: 'component', label: 'C', x: 300, y: 0, w: 40, h: 40 },
      ],
      edges: [
        {
          id: 'ef',
          from: 'a',
          to: 'b',
          style: { route: 'flexionalHorizontal', routeExtend: 20 },
        },
        {
          id: 'el',
          from: 'c',
          to: 'c',
          style: { loopedType: 'arc', loopedDirection: 'north' },
        },
      ],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const flex = views.getEdge('ef')!
    const loop = views.getEdge('el')!
    expect(flex.isActive).toBe(true)
    expect(flex.points.length).toBeGreaterThanOrEqual(2)
    expect(loop.isActive).toBe(true)
    expect(loop.points.length).toBeGreaterThan(4)
  })

  it('fans three sibling bundleArc edges', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 0, y: 0, w: 40, h: 40 },
        { id: 'b', type: 'component', label: 'B', x: 160, y: 0, w: 40, h: 40 },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', style: { route: 'bundleArc', bundleGap: 10 } },
        { id: 'e1', from: 'a', to: 'b', style: { route: 'bundleArc', bundleGap: 10 } },
        { id: 'e2', from: 'a', to: 'b', style: { route: 'bundleArc', bundleGap: 10 } },
      ],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    // Second validate picks up dirty from bundle offset change.
    views.validateDirty(scene)
    const ys = ['e0', 'e1', 'e2'].map(id => {
      const pts = views.getEdge(id)!.points
      return pts.reduce((s, p) => s + p.y, 0) / pts.length
    })
    const unique = new Set(ys.map(y => Math.round(y * 10) / 10))
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })

  it('paints arrow shape and flow fields on the DTO', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'component', label: 'A', x: 0, y: 0, w: 40, h: 40 },
        { id: 'b', type: 'component', label: 'B', x: 120, y: 0, w: 40, h: 40 },
      ],
      edges: [{
        id: 'e',
        from: 'a',
        to: 'b',
        style: {
          route: 'straight',
          flow: true,
          corner: 'bevel',
          cornerRadius: 10,
          arrow: { shape: 'diamond', size: 12 },
        },
      }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene, { flowPhase: 1000 })
    const paint = views.getEdge('e')!.toPaintView(false, false)
    expect(paint.corner).toBe('bevel')
    expect(paint.flowDashOffset).toBeDefined()
    expect(paint.arrowTo?.shape).toBe('diamond')
  })
})

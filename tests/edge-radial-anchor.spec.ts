/**
 * Radial anchors — center→peer ray exit on each box (ring spokes into a hub).
 */

import { describe, expect, it } from 'vitest'
import { radialAnchor, rayRectExit } from '../src/ui/bounds.ts'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('radialAnchor', () => {
  const lake = { x: 462, y: 312, width: 196, height: 96 }
  const collect = { x: 484, y: 48, width: 152, height: 64 }

  it('hits the facing sides of station and lake', () => {
    const start = radialAnchor(collect, lake)
    const end = radialAnchor(lake, collect)
    expect(start).toEqual({ x: 560, y: 112 })
    expect(end).toEqual({ x: 560, y: 312 })
  })

  it('toOutset pushes the lake port outward toward the station', () => {
    const end = radialAnchor(lake, collect, 6)
    expect(end.x).toBeCloseTo(560, 5)
    expect(end.y).toBeCloseTo(306, 5)
  })
})

describe('rayRectExit', () => {
  it('returns undefined for a degenerate ray', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 }
    expect(rayRectExit(box, { x: 5, y: 5 }, { x: 5, y: 5 })).toBeUndefined()
  })
})

describe('EdgeView radial spokes', () => {
  it('lands on lake boundary with toOutset matching the reference pad', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [
        {
          id: 'collect',
          type: 'component',
          label: '数据采集',
          x: 484,
          y: 48,
          w: 152,
          h: 64,
        },
        {
          id: 'lake',
          type: 'component',
          label: '湖仓底座',
          x: 462,
          y: 312,
          w: 196,
          h: 96,
        },
      ],
      edges: [{
        id: 's-collect',
        from: 'collect',
        to: 'lake',
        fromAnchor: 'radial',
        toAnchor: 'radial',
        toOutset: 6,
        style: { route: 'straight' },
      }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const pts = views.getEdge('s-collect')!.points
    expect(pts).toHaveLength(2)
    expect(pts[0]).toEqual({ x: 560, y: 112 })
    expect(pts[1]!.x).toBeCloseTo(560, 5)
    expect(pts[1]!.y).toBeCloseTo(306, 5)
  })
})

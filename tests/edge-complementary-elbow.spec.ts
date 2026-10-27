/**
 * Complementary anchors (bottom→right etc.) prefer a two-segment elbow;
 * collapse remap must keep the same segment count and arrive side.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { complementaryElbow, edgeAnchorsFromRects } from '../src/ui/bounds.ts'
import { ViewSet } from '../src/ui/view-set.ts'

function segmentCount(points: readonly { x: number; y: number }[]): number {
  return Math.max(0, points.length - 1)
}

describe('complementaryElbow', () => {
  it('builds bottom→right as vertical then horizontal (two segments)', () => {
    const from = { x: 100, y: 50 }
    const to = { x: 200, y: 150 }
    const path = complementaryElbow(from, to, 'bottom', 'right')!
    expect(path).toEqual([
      from,
      { x: 100, y: 150 },
      to,
    ])
    expect(segmentCount(path)).toBe(2)
  })

  it('builds left→top as horizontal then vertical', () => {
    const from = { x: 50, y: 100 }
    const to = { x: 150, y: 40 }
    const path = complementaryElbow(from, to, 'left', 'top')!
    expect(path).toEqual([
      from,
      { x: 150, y: 100 },
      to,
    ])
  })

  it('returns undefined for parallel sides (bottom→top)', () => {
    expect(complementaryElbow(
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      'bottom',
      'top',
    )).toBeUndefined()
  })
})

describe('edgeAnchorsFromRects complementary hints', () => {
  const upper = { x: 100, y: 40, width: 80, height: 40 }
  const lower = { x: 220, y: 160, width: 100, height: 60 }

  it('uses two segments without waypoints for bottom→right', () => {
    const route = edgeAnchorsFromRects(upper, lower, undefined, {
      from: 'bottom',
      to: 'right',
    })
    expect(segmentCount(route.points)).toBe(2)
    expect(route.points[0]).toEqual({ x: 140, y: 80 })
    expect(route.points[route.points.length - 1]).toEqual({ x: 320, y: 190 })
    expect(route.points[1]).toEqual({ x: 140, y: 190 })
  })

  it('ignores stale absolute waypoints when complementary elbows apply', () => {
    const route = edgeAnchorsFromRects(upper, lower, [{ x: 999, y: 999 }], {
      from: 'bottom',
      to: 'right',
    })
    expect(segmentCount(route.points)).toBe(2)
    expect(route.points[1]).toEqual({ x: 140, y: 190 })
  })
})

describe('collapse remap keeps two-segment bottom→right', () => {
  it('expanded and collapsed share segment count and right-side arrival', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'm3', type: 'agent', label: '认识价值', x: 100, y: 40, w: 80, h: 40 },
        {
          id: 'm4',
          type: 'agent',
          label: '认知工业化',
          x: 220,
          y: 160,
          w: 100,
          h: 60,
          groupId: 'mid',
        },
        {
          id: 'm5',
          type: 'agent',
          label: 'peer',
          x: 340,
          y: 160,
          w: 50,
          h: 50,
          groupId: 'mid',
        },
      ],
      edges: [{
        id: 'e-val-mid',
        from: 'm3',
        to: 'm4',
        fromAnchor: 'bottom',
        toAnchor: 'right',
        waypoints: [{ x: 140, y: 190 }],
      }],
      groups: [{
        id: 'mid',
        label: '中层',
        memberIds: ['m4', 'm5'],
        expanded: true,
        x: 200,
        y: 140,
        w: 80,
        h: 50,
      }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const expanded = views.getEdge('e-val-mid')!
    expect(expanded.isActive).toBe(true)
    expect(segmentCount(expanded.points)).toBe(2)
    const expTo = expanded.points[expanded.points.length - 1]!
    expect(expTo.x).toBeCloseTo(320)
    expect(expTo.y).toBeCloseTo(190)

    scene.apply({ ops: [{ op: 'updateGroup', id: 'mid', patch: { expanded: false } }] })
    views.markGroupGeometryDirty(scene, 'mid')
    views.validateDirty(scene)
    const collapsed = views.getEdge('e-val-mid')!
    expect(collapsed.isActive).toBe(true)
    expect(segmentCount(collapsed.points)).toBe(2)
    const colTo = collapsed.points[collapsed.points.length - 1]!
    const group = views.getGroup('mid')!
    expect(colTo.x).toBeCloseTo(group.bandBounds.x + group.bandBounds.width)
    expect(colTo.y).toBeGreaterThanOrEqual(group.bandBounds.y - 1)
    expect(colTo.y).toBeLessThanOrEqual(group.bandBounds.y + group.bandBounds.height + 1)
  })
})

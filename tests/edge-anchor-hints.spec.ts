import { describe, expect, it } from 'vitest'

import { edgeAnchors } from '../src/ui/bounds.ts'
import type { GraphNode } from '../src/protocol/types.ts'

function node(id: string, x: number, y: number, w = 50, h = 50): GraphNode {
  return { id, type: 'node', label: id, x, y, w, h }
}

describe('edge anchor hints', () => {
  const mount = node('mount', 640, 120)
  const portal = node('portal', 790, 320)

  it('pins source bottom center and target top center', () => {
    const anchors = edgeAnchors(mount, portal, undefined, { from: 'bottom', to: 'top' })
    expect(anchors.from).toEqual({ x: 665, y: 170 })
    expect(anchors.to).toEqual({ x: 815, y: 320 })
    expect(anchors.orientation).toBe('vertical')
  })

  it('keeps waypoints between the pinned anchors', () => {
    const anchors = edgeAnchors(mount, portal, [{ x: 815, y: 220 }], { from: 'bottom', to: 'top' })
    expect(anchors.points[0]).toEqual({ x: 665, y: 170 })
    expect(anchors.points).toContainEqual({ x: 815, y: 220 })
    expect(anchors.points[anchors.points.length - 1]).toEqual({ x: 815, y: 320 })
  })

  it('routes orthogonally when hints come without waypoints', () => {
    const anchors = edgeAnchors(mount, portal, undefined, { from: 'bottom', to: 'top' })
    // Every segment is axis-aligned: consecutive points share x or y.
    for (let i = 1; i < anchors.points.length; i += 1) {
      const a = anchors.points[i - 1]
      const b = anchors.points[i]
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
  })

  it('auto behavior is unchanged without hints', () => {
    const withHints = edgeAnchors(mount, portal, undefined, {})
    const withoutHints = edgeAnchors(mount, portal)
    expect(withHints).toEqual(withoutHints)
  })
})

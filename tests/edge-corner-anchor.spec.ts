/**
 * Corner edge anchors (twaver link.from.position corner idea):
 * pin box corners; corners count as vertical leave/arrive for elbows.
 */

import { describe, expect, it } from 'vitest'

import { parseDocument } from '../src/protocol/parse.ts'
import {
  anchorPoint,
  complementaryElbow,
  edgeAnchors,
  edgeAnchorsFromRects,
} from '../src/ui/bounds.ts'
import type { GraphNode } from '../src/protocol/types.ts'

function node(id: string, x: number, y: number, w = 50, h = 50): GraphNode {
  return { id, type: 'node', label: id, x, y, w, h }
}

describe('corner edge anchors', () => {
  const box = { x: 100, y: 40, width: 80, height: 40 }

  it('pins the four box corners', () => {
    expect(anchorPoint('topLeft', box)).toEqual({ x: 100, y: 40 })
    expect(anchorPoint('topRight', box)).toEqual({ x: 180, y: 40 })
    expect(anchorPoint('bottomLeft', box)).toEqual({ x: 100, y: 80 })
    expect(anchorPoint('bottomRight', box)).toEqual({ x: 180, y: 80 })
  })

  it('parses bottomRight / topLeft on GraphEdge', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'node', label: 'A', x: 0, y: 0, w: 50, h: 50 },
        { id: 'b', type: 'node', label: 'B', x: 120, y: 100, w: 50, h: 50 },
      ],
      edges: [
        {
          id: 'e1',
          from: 'a',
          to: 'b',
          fromAnchor: 'bottomRight',
          toAnchor: 'topLeft',
        },
      ],
    })
    expect(doc.edges[0]?.fromAnchor).toBe('bottomRight')
    expect(doc.edges[0]?.toAnchor).toBe('topLeft')
  })

  it('rejects unknown corner-like tokens (fail loud)', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'node', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'node', label: 'B', x: 100, y: 0 },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b', fromAnchor: 'bottomright' },
      ],
    })).toThrow(/fromAnchor/)
  })

  it('staggers bottomRight leave away from bottom-center', () => {
    const upper = node('nv', 280, 80, 148, 64)
    const lower = node('ai', 480, 280, 148, 64)
    const corner = edgeAnchors(upper, lower, undefined, {
      from: 'bottomRight',
      to: 'top',
    })
    const mid = edgeAnchors(upper, lower, undefined, {
      from: 'bottom',
      to: 'top',
    })
    expect(corner.from).toEqual({ x: 428, y: 144 })
    expect(mid.from).toEqual({ x: 354, y: 144 })
    expect(corner.from.x).not.toBe(mid.from.x)
  })

  it('builds bottomRight→left as a complementary two-segment elbow', () => {
    const path = complementaryElbow(
      { x: 180, y: 80 },
      { x: 220, y: 160 },
      'bottomRight',
      'left',
    )!
    expect(path).toEqual([
      { x: 180, y: 80 },
      { x: 180, y: 160 },
      { x: 220, y: 160 },
    ])
  })

  it('routes bottomRight→top with waypoints without sharing bottom-center trunk', () => {
    const fromBox = { x: 280, y: 80, width: 148, height: 64 }
    const toBox = { x: 480, y: 280, width: 148, height: 64 }
    const route = edgeAnchorsFromRects(
      fromBox,
      toBox,
      [
        { x: 440, y: 212 },
        { x: 554, y: 212 },
      ],
      { from: 'bottomRight', to: 'top' },
    )
    expect(route.from).toEqual({ x: 428, y: 144 })
    expect(route.to).toEqual({ x: 554, y: 280 })
    expect(route.points[0]).toEqual(route.from)
    for (let i = 1; i < route.points.length; i += 1) {
      const a = route.points[i - 1]!
      const b = route.points[i]!
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
  })
})

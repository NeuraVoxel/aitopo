import { describe, expect, it } from 'vitest'
import { buildPropertyPatch } from '../demo/lib/property-patch.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'
import type {
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPath,
  GraphShapeNode,
} from '../src/protocol/types.ts'

const node: GraphNode = {
  id: 'a',
  type: 'agent',
  label: 'A',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  style: { labelPosition: 'top', label: { color: '#111', maxChars: 8 } },
  data: { role: 'src' },
}

const edge: GraphEdge = {
  id: 'e1',
  from: 'a',
  to: 'b',
  kind: 'data',
  label: 'link',
  style: { stroke: '#2563eb', lineWidth: 2, label: { color: '#222' } },
}

const group: GraphGroup = {
  id: 'g1',
  label: 'Band',
  memberIds: ['a'],
  expanded: false,
  x: 4,
  y: 6,
  w: 40,
  h: 20,
  style: { fill: '#eee', stroke: '#333', strokeWidth: 1, label: { fontSize: 12 } },
}

const path: GraphPath = {
  id: 'p1',
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  closed: true,
  label: 'Path',
  angle: 15,
  angleAnchor: { u: 0.25, v: 0.75 },
  style: { stroke: '#111', lineWidth: 2, fill: '#abc', label: { color: '#333' } },
}

const shapeNode: GraphShapeNode = {
  id: 's1',
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 15 }],
  label: 'Shape',
  angle: 30,
  style: { fill: '#fed', stroke: '#321', lineWidth: 1 },
}

describe('buildPropertyPatch', () => {
  it('updates node label and geometry', () => {
    const patch = buildPropertyPatch(
      { kind: 'node', element: node },
      { label: 'Renamed', x: 5 },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: { label: 'Renamed', x: 5 },
    }])
  })

  it('updates node type', () => {
    const patch = buildPropertyPatch(
      { kind: 'node', element: node },
      { type: 'service' },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: { type: 'service' },
    }])
  })

  it('maps node label style fields and keeps existing label text style', () => {
    const patch = buildPropertyPatch(
      { kind: 'node', element: node },
      { labelPosition: 'bottom', labelColor: '#f00', labelFontSize: 14 },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: {
        style: {
          labelPosition: 'bottom',
          label: { color: '#f00', maxChars: 8, fontSize: 14 },
        },
      },
    }])
  })

  it('omits node fill, stroke, and strokeWidth (not in GraphNodeStyle)', () => {
    const patch = buildPropertyPatch(
      { kind: 'node', element: node },
      { fill: '#fff', stroke: '#000', strokeWidth: 3, label: 'A' },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: { label: 'A' },
    }])
  })

  it('updates edge label and kind; maps strokeWidth to lineWidth', () => {
    const patch = buildPropertyPatch(
      { kind: 'edge', element: edge },
      { label: 'wired', kind: 'control', stroke: '#16a34a', strokeWidth: 3 },
    )
    expect(patch.ops).toEqual([{
      op: 'updateEdge',
      id: 'e1',
      patch: {
        label: 'wired',
        kind: 'control',
        style: { stroke: '#16a34a', lineWidth: 3 },
      },
    }])
  })

  it('maps edge label color without dropping existing label style', () => {
    const patch = buildPropertyPatch(
      { kind: 'edge', element: edge },
      { labelColor: '#abc' },
    )
    expect(patch.ops).toEqual([{
      op: 'updateEdge',
      id: 'e1',
      patch: { style: { label: { color: '#abc' } } },
    }])
  })

  it('updates group geometry, expanded, and band styles', () => {
    const patch = buildPropertyPatch(
      { kind: 'group', element: group },
      {
        label: 'Cluster',
        x: 8,
        y: 9,
        w: 50,
        h: 30,
        expanded: true,
        fill: '#cfc',
        stroke: '#080',
        strokeWidth: 2,
        labelPosition: 'insideTopLeft',
        labelFontSize: 16,
      },
    )
    expect(patch.ops).toEqual([{
      op: 'updateGroup',
      id: 'g1',
      patch: {
        label: 'Cluster',
        x: 8,
        y: 9,
        w: 50,
        h: 30,
        expanded: true,
        style: {
          fill: '#cfc',
          stroke: '#080',
          strokeWidth: 2,
          labelPosition: 'insideTopLeft',
          label: { fontSize: 16 },
        },
      },
    }])
  })

  it('parses dataJson as a string-only object', () => {
    const patch = buildPropertyPatch(
      { kind: 'node', element: node },
      { dataJson: '{"role":"dst","note":"ok"}' },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: { data: { role: 'dst', note: 'ok' } },
    }])
  })

  it('throws on invalid dataJson', () => {
    expect(() => buildPropertyPatch(
      { kind: 'node', element: node },
      { dataJson: '{nope' },
    )).toThrow(/dataJson/)
  })

  it('throws when dataJson is not an object of strings', () => {
    expect(() => buildPropertyPatch(
      { kind: 'node', element: node },
      { dataJson: '{"n":1}' },
    )).toThrow(/string/)
    expect(() => buildPropertyPatch(
      { kind: 'edge', element: edge },
      { dataJson: '[]' },
    )).toThrow(/object/)
  })

  it('throws on invalid labelPosition', () => {
    expect(() => buildPropertyPatch(
      { kind: 'node', element: node },
      { labelPosition: 'north' },
    )).toThrow(/labelPosition/)
  })

  it('emits a valid updateNode that applyPatch accepts', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [node],
      edges: [],
    })
    const next = applyPatch(doc, buildPropertyPatch(
      { kind: 'node', element: node },
      { label: 'Renamed', x: 5, labelColor: '#f00' },
    ))
    expect(next.nodes[0]?.label).toBe('Renamed')
    expect(next.nodes[0]?.x).toBe(5)
    expect(next.nodes[0]?.style?.label?.color).toBe('#f00')
    expect(next.nodes[0]?.style?.label?.maxChars).toBe(8)
  })

  it('updates node angle and merges angleAnchor u/v', () => {
    const angled: GraphNode = {
      ...node,
      angle: 10,
      angleAnchor: { u: 0, v: 1 },
    }
    const patch = buildPropertyPatch(
      { kind: 'node', element: angled },
      { angle: 45, angleAnchorU: 0.25 },
    )
    expect(patch.ops).toEqual([{
      op: 'updateNode',
      id: 'a',
      patch: { angle: 45, angleAnchor: { u: 0.25, v: 1 } },
    }])
  })

  it('updates group angle with default center anchor when none set', () => {
    const patch = buildPropertyPatch(
      { kind: 'group', element: group },
      { angle: 90, angleAnchorV: 0 },
    )
    expect(patch.ops).toEqual([{
      op: 'updateGroup',
      id: 'g1',
      patch: { angle: 90, angleAnchor: { u: 0.5, v: 0 } },
    }])
  })

  it('updates path angle, fill, and strokeWidth as lineWidth', () => {
    const patch = buildPropertyPatch(
      { kind: 'path', element: path },
      { angle: 40, fill: '#0f0', strokeWidth: 4, labelColor: '#999' },
    )
    expect(patch.ops).toEqual([{
      op: 'updatePath',
      id: 'p1',
      patch: {
        angle: 40,
        style: {
          fill: '#0f0',
          lineWidth: 4,
          label: { color: '#999' },
        },
      },
    }])
  })

  it('updates shapeNode angle and styles', () => {
    const patch = buildPropertyPatch(
      { kind: 'shapeNode', element: shapeNode },
      { angle: 12, angleAnchorU: 1, angleAnchorV: 0, fill: '#fff', stroke: '#000' },
    )
    expect(patch.ops).toEqual([{
      op: 'updateShapeNode',
      id: 's1',
      patch: {
        angle: 12,
        angleAnchor: { u: 1, v: 0 },
        style: { fill: '#fff', stroke: '#000' },
      },
    }])
  })
})

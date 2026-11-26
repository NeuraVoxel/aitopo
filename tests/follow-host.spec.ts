import { describe, expect, it } from 'vitest'
import { listTransitiveFollowers } from '../src/model/follow.ts'
import { GraphScene } from '../src/model/scene.ts'
import { applyPatch, parseDocument } from '../src/protocol/index.ts'
import type { GraphDocument } from '../src/protocol/types.ts'

function baseDoc(overrides: Partial<GraphDocument> = {}): GraphDocument {
  return {
    version: 1,
    nodes: [
      { id: 'host', type: 'n', label: 'Host', x: 100, y: 200 },
      { id: 'follower', type: 'n', label: 'Follower', x: 10, y: 20, followHostId: 'host' },
    ],
    edges: [],
    ...overrides,
  }
}

describe('followHostId', () => {
  it('translates a node follower when the host moves via patch', () => {
    const doc = parseDocument(baseDoc())
    const next = applyPatch(doc, {
      ops: [{ op: 'updateNode', id: 'host', patch: { x: 130, y: 250 } }],
    })
    expect(next.nodes.find(n => n.id === 'host')).toMatchObject({ x: 130, y: 250 })
    expect(next.nodes.find(n => n.id === 'follower')).toMatchObject({ x: 40, y: 70 })
  })

  it('translates a path follower with the host (dx, dy)', () => {
    const doc = parseDocument(baseDoc({
      paths: [
        {
          id: 'trail',
          followHostId: 'host',
          points: [
            { x: 100, y: 200 },
            { x: 80, y: 220 },
            { x: 60, y: 240 },
          ],
          style: { stroke: '#abc', lineWidth: 2 },
        },
      ],
    }))
    const next = applyPatch(doc, {
      ops: [{ op: 'updateNode', id: 'host', patch: { x: 110, y: 210 } }],
    })
    expect(next.paths?.[0]?.points).toEqual([
      { x: 110, y: 210 },
      { x: 90, y: 230 },
      { x: 70, y: 250 },
    ])
  })

  it('cascades through transitive followers', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'n', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'n', label: 'B', x: 10, y: 10, followHostId: 'a' },
        { id: 'c', type: 'n', label: 'C', x: 20, y: 20, followHostId: 'b' },
      ],
      edges: [],
    })
    const next = applyPatch(doc, {
      ops: [{ op: 'updateNode', id: 'a', patch: { x: 5, y: 7 } }],
    })
    expect(next.nodes.find(n => n.id === 'b')).toMatchObject({ x: 15, y: 17 })
    expect(next.nodes.find(n => n.id === 'c')).toMatchObject({ x: 25, y: 27 })
  })

  it('does not double-translate a follower that is also moved explicitly', () => {
    const doc = parseDocument(baseDoc())
    const next = applyPatch(doc, {
      ops: [
        { op: 'updateNode', id: 'host', patch: { x: 120, y: 220 } },
        { op: 'updateNode', id: 'follower', patch: { x: 50, y: 60 } },
      ],
    })
    expect(next.nodes.find(n => n.id === 'follower')).toMatchObject({ x: 50, y: 60 })
  })

  it('clears followHostId when the host is removed', () => {
    const doc = parseDocument(baseDoc({
      paths: [
        {
          id: 'trail',
          followHostId: 'host',
          points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        },
      ],
    }))
    const next = applyPatch(doc, {
      ops: [{ op: 'removeNode', id: 'host' }],
    })
    expect(next.nodes.find(n => n.id === 'host')).toBeUndefined()
    expect(next.nodes.find(n => n.id === 'follower')?.followHostId).toBeUndefined()
    expect(next.paths?.[0]?.followHostId).toBeUndefined()
  })

  it('fails loud on missing host at parse', () => {
    expect(() => parseDocument(baseDoc({
      nodes: [
        { id: 'follower', type: 'n', label: 'F', followHostId: 'missing' },
      ],
    }))).toThrow(/missing host/)
  })

  it('fails loud on follow cycles at parse', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'n', label: 'A', followHostId: 'b' },
        { id: 'b', type: 'n', label: 'B', followHostId: 'a' },
      ],
      edges: [],
    })).toThrow(/cycle/)
  })

  it('fails loud on self-follow at parse', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'n', label: 'A', followHostId: 'a' }],
      edges: [],
    })).toThrow(/cannot follow itself/)
  })

  it('preview writePositions translates path followers', () => {
    const scene = new GraphScene()
    scene.load(baseDoc({
      paths: [
        {
          id: 'trail',
          followHostId: 'host',
          points: [
            { x: 100, y: 200 },
            { x: 90, y: 210 },
          ],
        },
      ],
    }))
    scene.writePositions({ host: { x: 140, y: 260 } })
    expect(scene.nodes.get('host')).toMatchObject({ x: 140, y: 260 })
    expect(scene.nodes.get('follower')).toMatchObject({ x: 50, y: 80 })
    expect(scene.paths.get('trail')?.points).toEqual([
      { x: 140, y: 260 },
      { x: 130, y: 270 },
    ])
  })

  it('lists transitive followers for preview dirtying', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'n', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'n', label: 'B', x: 1, y: 1, followHostId: 'a' },
      ],
      edges: [],
      paths: [
        {
          id: 'trail',
          followHostId: 'a',
          points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        },
      ],
    })
    expect(listTransitiveFollowers(doc, 'a').sort()).toEqual(['b', 'trail'])
  })
})

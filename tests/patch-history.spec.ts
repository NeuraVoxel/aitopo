import { describe, expect, it } from 'vitest'
import { invertOp, invertPatch } from '../src/protocol/invert.ts'
import { PatchHistory } from '../src/protocol/patch-history.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('invertOp', () => {
  const base = parseDocument({
    version: 1,
    nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
    edges: [{ id: 'e1', from: 'a', to: 'a' }],
    viewport: { x: 0, y: 0, zoom: 1 },
  })

  it('inverts updateNode to prior x/y', () => {
    const inv = invertOp(base, { op: 'updateNode', id: 'a', patch: { x: 10, y: 20 } })
    expect(inv).toEqual({ op: 'updateNode', id: 'a', patch: { x: 1, y: 2 } })
  })

  it('skips SubNetwork navigation and setSelection', () => {
    expect(invertOp(base, { op: 'enterSubNetwork', id: 'n1' })).toEqual([])
    expect(invertOp(base, { op: 'exitSubNetwork' })).toEqual([])
    expect(invertOp(base, { op: 'setSelection', selectedIds: ['a'] })).toEqual([])
  })

  it('removeNode inverse restores node and cascaded edges', () => {
    const inv = invertOp(base, { op: 'removeNode', id: 'a' })
    expect(inv).toEqual([
      { op: 'addNode', node: { id: 'a', type: 'agent', label: 'A', x: 1, y: 2 } },
      { op: 'addEdge', edge: { id: 'e1', from: 'a', to: 'a' } },
    ])
  })

  it('invertPatch reverses multi-op order', () => {
    const ops = invertPatch(base, {
      ops: [
        { op: 'updateNode', id: 'a', patch: { x: 9 } },
        { op: 'setViewport', viewport: { x: 5, y: 5, zoom: 2 } },
      ],
    })
    expect(ops).toEqual([
      { op: 'setViewport', viewport: { x: 0, y: 0, zoom: 1 } },
      { op: 'updateNode', id: 'a', patch: { x: 1 } },
    ])
  })

  it('invertPatch handles a large independent updateNode batch under a time budget', () => {
    const nodes = Array.from({ length: 2000 }, (_, i) => ({
      id: `n${i}`,
      type: 'agent',
      label: `N${i}`,
      x: i,
      y: i * 2,
    }))
    const doc = parseDocument({ version: 1, nodes, edges: [] })
    const patch = {
      ops: nodes.map(n => ({
        op: 'updateNode' as const,
        id: n.id,
        patch: { x: n.x + 3, y: n.y + 4 },
      })),
    }
    const started = performance.now()
    const inv = invertPatch(doc, patch)
    expect(performance.now() - started).toBeLessThan(1_000)
    expect(inv).toHaveLength(2000)
    expect(inv[0]).toEqual({ op: 'updateNode', id: 'n1999', patch: { x: 1999, y: 3998 } })
    expect(inv[1999]).toEqual({ op: 'updateNode', id: 'n0', patch: { x: 0, y: 0 } })
  })

  it('inverts edge waypoint updates including clear-to-auto', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'agent', label: 'A' },
        { id: 'b', type: 'agent', label: 'B' },
      ],
      edges: [{
        id: 'e1',
        from: 'a',
        to: 'b',
        waypoints: [{ x: 1, y: 2 }],
      }],
    })
    const inv = invertOp(doc, {
      op: 'updateEdge',
      id: 'e1',
      patch: { waypoints: [{ x: 9, y: 9 }] },
    })
    expect(inv).toEqual({
      op: 'updateEdge',
      id: 'e1',
      patch: { waypoints: [{ x: 1, y: 2 }] },
    })
    const cleared = applyPatch(doc, {
      ops: [{ op: 'updateEdge', id: 'e1', patch: { waypoints: [] } }],
    })
    expect(cleared.edges[0]?.waypoints).toBeUndefined()
    const restore = invertOp(cleared, {
      op: 'updateEdge',
      id: 'e1',
      patch: { waypoints: [{ x: 1, y: 2 }] },
    })
    expect(restore).toEqual({
      op: 'updateEdge',
      id: 'e1',
      patch: { waypoints: [] },
    })
  })
})

describe('PatchHistory', () => {
  it('updateNode undo restores x/y; redo reapplies', () => {
    let doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
      edges: [],
    })
    const history = new PatchHistory(
      (patch) => { doc = applyPatch(doc, patch) },
      () => doc,
    )

    history.pushAndApply({ ops: [{ op: 'updateNode', id: 'a', patch: { x: 10, y: 20 } }] })
    expect(doc.nodes[0]?.x).toBe(10)
    expect(doc.nodes[0]?.y).toBe(20)

    expect(history.undo()).toBe(true)
    expect(doc.nodes[0]?.x).toBe(1)
    expect(doc.nodes[0]?.y).toBe(2)

    expect(history.redo()).toBe(true)
    expect(doc.nodes[0]?.x).toBe(10)
    expect(doc.nodes[0]?.y).toBe(20)
  })

  it('failed apply does not push', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
      edges: [],
    })
    const history = new PatchHistory(
      () => { throw new Error('apply failed') },
      () => doc,
    )

    expect(() => history.pushAndApply({
      ops: [{ op: 'updateNode', id: 'a', patch: { x: 3 } }],
    })).toThrow(/apply failed/)

    expect(history.undo()).toBe(false)
    expect(doc.nodes[0]?.x).toBe(1)
  })

  it('clear drops undo and redo stacks', () => {
    let doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 1, y: 2 }],
      edges: [],
    })
    const history = new PatchHistory(
      (patch) => { doc = applyPatch(doc, patch) },
      () => doc,
    )
    history.pushAndApply({ ops: [{ op: 'updateNode', id: 'a', patch: { x: 3 } }] })
    expect(history.undo()).toBe(true)
    history.clear()
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
  })
})

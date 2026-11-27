import { describe, expect, it } from 'vitest'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('applyPatch', () => {
  const base = parseDocument({
    version: 1,
    nodes: [{ id: 'a', type: 'agent', label: 'A' }],
    edges: [],
  })

  it('adds and removes a node', () => {
    const withB = applyPatch(base, {
      ops: [{ op: 'addNode', node: { id: 'b', type: 'agent', label: 'B' } }],
    })
    expect(withB.nodes).toHaveLength(2)
    const removed = applyPatch(withB, { ops: [{ op: 'removeNode', id: 'b' }] })
    expect(removed.nodes).toHaveLength(1)
    expect(base.nodes).toHaveLength(1)
  })

  it('throws on missing update target without mutating input', () => {
    expect(() => applyPatch(base, {
      ops: [{ op: 'updateNode', id: 'missing', patch: { label: 'X' } }],
    })).toThrow(/missing id/)
    expect(base.nodes[0]?.label).toBe('A')
  })

  it('applies a large updateNode-only batch without mutating input', () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `n${i}`,
      type: 'agent',
      label: `N${i}`,
      x: i,
      y: i,
    }))
    const doc = parseDocument({ version: 1, nodes, edges: [] })
    const started = performance.now()
    const next = applyPatch(doc, {
      ops: nodes.map(n => ({
        op: 'updateNode' as const,
        id: n.id,
        patch: { x: n.x + 1, y: n.y + 2 },
      })),
    })
    expect(performance.now() - started).toBeLessThan(500)
    expect(next.nodes[0]?.x).toBe(1)
    expect(next.nodes[499]?.y).toBe(501)
    expect(doc.nodes[0]?.x).toBe(0)
  })

  it('sets alarms on a node', () => {
    const next = applyPatch(base, {
      ops: [{
        op: 'setAlarms',
        elementId: 'a',
        target: 'node',
        alarms: [{ id: 'e1', level: 'error', message: 'failed' }],
      }],
    })
    expect(next.nodes[0]?.alarms?.[0]?.level).toBe('error')
  })

  it('addEdge accepts group endpoints and removeGroup cascades those edges', () => {
    const withGroups = applyPatch(base, {
      ops: [
        { op: 'addGroup', group: { id: 'g1', label: 'G1', memberIds: [] } },
        { op: 'addGroup', group: { id: 'g2', label: 'G2', memberIds: [] } },
        { op: 'addEdge', edge: { id: 'eg', from: 'g1', to: 'g2' } },
        { op: 'addEdge', edge: { id: 'en', from: 'g1', to: 'a' } },
      ],
    })
    expect(withGroups.edges.map(e => e.id).sort()).toEqual(['eg', 'en'])
    const after = applyPatch(withGroups, { ops: [{ op: 'removeGroup', id: 'g1' }] })
    expect(after.groups?.map(g => g.id)).toEqual(['g2'])
    expect(after.edges).toHaveLength(0)
  })

  it('rejects addNode / addGroup when the id is already used by the other kind', () => {
    const withGroup = applyPatch(base, {
      ops: [{ op: 'addGroup', group: { id: 'g1', label: 'G1', memberIds: [] } }],
    })
    expect(() => applyPatch(withGroup, {
      ops: [{ op: 'addNode', node: { id: 'g1', type: 'agent', label: 'clash' } }],
    })).toThrow(/already used by a group/)
    expect(() => applyPatch(base, {
      ops: [{ op: 'addGroup', group: { id: 'a', label: 'clash', memberIds: [] } }],
    })).toThrow(/already used by a node/)
  })

  it('rejects addEdge when an endpoint is missing', () => {
    expect(() => applyPatch(base, {
      ops: [{ op: 'addEdge', edge: { id: 'e', from: 'a', to: 'ghost' } }],
    })).toThrow(/not a node or group/)
  })
})

import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/parse.ts'

describe('parseDocument', () => {
  it('parses a minimal valid document', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A' }],
      edges: [],
    })
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0]?.id).toBe('a')
  })

  it('rejects missing node id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ type: 'agent', label: 'A' }],
      edges: [],
    })).toThrow(/parse failed/)
  })

  it('rejects unknown version', () => {
    expect(() => parseDocument({
      version: 2,
      nodes: [],
      edges: [],
    })).toThrow(/parse failed/)
  })

  it('accepts group ids as edge endpoints', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{ id: 'n', type: 'agent', label: 'N' }],
      edges: [
        { id: 'gg', from: 'g1', to: 'g2' },
        { id: 'gn', from: 'g1', to: 'n' },
      ],
      groups: [
        { id: 'g1', label: 'G1', memberIds: [] },
        { id: 'g2', label: 'G2', memberIds: [] },
      ],
    })
    expect(doc.edges).toHaveLength(2)
  })

  it('rejects edge endpoints that are neither node nor group', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A' }],
      edges: [{ id: 'e', from: 'a', to: 'missing' }],
    })).toThrow(/not a node or group/)
  })

  it('rejects node and group id clash', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'same', type: 'agent', label: 'N' }],
      edges: [],
      groups: [{ id: 'same', label: 'G', memberIds: [] }],
    })).toThrow(/both a node and a group/)
  })
})

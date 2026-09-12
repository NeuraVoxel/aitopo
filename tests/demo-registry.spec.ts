import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/index.ts'
import { DEFAULT_SAMPLE_ID, getSample, listSamples } from '../demo/samples/registry.ts'

describe('demo sample registry', () => {
  it('defaults to hello-world with two nodes and one edge', () => {
    const sample = getSample(DEFAULT_SAMPLE_ID)
    expect(sample).toBeDefined()
    const doc = parseDocument(sample!.document)
    expect(doc.nodes).toHaveLength(2)
    expect(doc.edges).toHaveLength(1)
  })

  it('lists getting-started before elements and marks business reserved', () => {
    const ids = listSamples().map(s => s.id)
    expect(ids[0]).toBe('hello-world')
    expect(listSamples().some(s => s.group === 'business' && s.reserved === true)).toBe(true)
  })
})

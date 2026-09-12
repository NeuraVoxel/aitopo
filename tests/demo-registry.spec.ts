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

  it('registers element showcases', () => {
    const ids = new Set(listSamples().map(s => s.id))
    for (const id of ['node', 'edge', 'group', 'alarm', 'subnetwork']) {
      expect(ids.has(id)).toBe(true)
      const sample = getSample(id)
      expect(sample?.group).toBe('elements')
      const doc = parseDocument(sample!.document)
      const count = doc.nodes.length + doc.edges.length + (doc.groups?.length ?? 0)
      expect(count).toBeLessThanOrEqual(15)
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
    }
    const group = parseDocument(getSample('group')!.document)
    expect(group.groups?.[0]?.expanded).toBe(true)
    expect(group.groups?.[0]?.style?.labelPosition).toBe('insideTopLeft')
    const alarm = parseDocument(getSample('alarm')!.document)
    expect(alarm.nodes.some(n => (n.alarms?.length ?? 0) > 0)).toBe(true)
    const sub = parseDocument(getSample('subnetwork')!.document)
    expect(sub.nodes.some(n => n.networkId === 'team-a')).toBe(true)
    expect(sub.networks?.['team-a']).toBeDefined()
  })
})

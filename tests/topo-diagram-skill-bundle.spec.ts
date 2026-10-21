import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/index.ts'

const samplePath = '.agents/skills/topo-diagram/assets/host/sample.graph.json'
const iifePath = '.agents/skills/topo-diagram/assets/aitopo.iife.js'

describe('topo-diagram skill sample', () => {
  it('parses golden graph with group cross-edge and subnetwork', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf8')) as unknown
    const doc = parseDocument(raw)
    expect(doc.groups?.some(g => g.expanded === true)).toBe(true)
    expect(doc.networks?.detail).toBeTruthy()
    const cross = doc.edges.find(e => e.id === 'cross')
    expect(cross?.from).toBe('a2')
    expect(cross?.to).toBe('b1')
  })

  it('IIFE file declares host contract symbols', () => {
    const s = readFileSync(iifePath, 'utf8')
    expect(s.startsWith('/*!')).toBe(true)
    for (const k of [
      'Network',
      'parseDocument',
      'CreateEdgeInteraction',
      'layoutGrid',
      'layoutFlowColumns',
    ]) {
      expect(s).toContain(k)
    }
  })
})

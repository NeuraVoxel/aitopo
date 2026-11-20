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

  it('lists started, elements, agents, dsh in order', () => {
    const samples = listSamples()
    expect(samples[0]?.id).toBe(DEFAULT_SAMPLE_ID)
    const groupIndexes = samples.map(s => s.group)
    const first = (group: string): number => groupIndexes.indexOf(group as never)
    const last = (group: string): number => groupIndexes.lastIndexOf(group as never)
    expect(last('started')).toBeLessThan(first('elements'))
    expect(last('elements')).toBeLessThan(first('agents'))
    expect(last('agents')).toBeLessThan(first('dsh'))
    expect(samples.filter(s => s.group === 'business')).toEqual([])
  })

  it('registers element showcases', () => {
    const ids = new Set(listSamples().map(s => s.id))
    for (const id of ['node', 'edge', 'group', 'alarm', 'subnetwork']) {
      expect(ids.has(id)).toBe(true)
      const sample = getSample(id)
      expect(sample?.group).toBe('elements')
      const doc = parseDocument(sample!.document)
      const count = doc.nodes.length + doc.edges.length + (doc.groups?.length ?? 0)
      // Edge is a full style.route catalog; other element demos stay compact.
      expect(count).toBeLessThanOrEqual(id === 'edge' ? 120 : 15)
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
    }
    const edge = parseDocument(getSample('edge')!.document)
    expect(edge.groups?.[0]?.id).toBe('band')
    expect(edge.groups?.[0]?.expanded).toBe(true)
    expect(edge.edges.some(e => e.from === 'a' && e.to === 'b')).toBe(true)
    expect(edge.edges.some(e => e.from === 'a' && e.to === 'out')).toBe(true)
    expect(edge.edges.some(e => e.from === 'band' && e.to === 'out')).toBe(true)
    expect(new Set(edge.edges.map(e => e.style?.route).filter(Boolean)).size).toBeGreaterThanOrEqual(10)
    const group = parseDocument(getSample('group')!.document)
    expect(group.groups?.[0]?.expanded).toBe(true)
    expect(group.groups?.map(g => g.id).sort()).toEqual(['band', 'band2'])
    expect(group.edges.some(e => e.from === 'band' && e.to === 'band2')).toBe(true)
    expect(group.edges.some(e => e.from === 'band' && e.to === 'outside')).toBe(true)
    expect(group.groups?.[0]?.style?.labelPosition).toBe('top')
    const alarm = parseDocument(getSample('alarm')!.document)
    expect(alarm.nodes.some(n => (n.alarms?.length ?? 0) > 0)).toBe(true)
    const sub = parseDocument(getSample('subnetwork')!.document)
    expect(sub.nodes.some(n => n.networkId === 'team-a')).toBe(true)
    expect(sub.networks?.['team-a']).toBeDefined()
  })

  it('registers the agents group with code agents, subagent, and skill workflow', () => {
    const groupSamples = listSamples().filter(s => s.group === 'agents')
    expect(groupSamples.map(s => s.id)).toEqual(['code-agents', 'subagent', 'skill-workflow'])

    for (const sample of groupSamples) {
      const doc = parseDocument(sample.document)
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
    }

    const codeAgents = parseDocument(groupSamples[0]!.document)
    expect(codeAgents.nodes.filter(n => n.type === 'agent').length).toBeGreaterThanOrEqual(5)
    expect(codeAgents.nodes.every(n => n.icon === undefined)).toBe(true)
    expect(codeAgents.nodes.length).toBeLessThanOrEqual(15)

    const subDoc = parseDocument(groupSamples[1]!.document)
    expect(subDoc.nodes.length + subDoc.edges.length).toBeLessThanOrEqual(15)
    const subAgent = subDoc.nodes.find(n => n.type === 'subagent')
    expect(subAgent?.networkId).toBe('agent-fleet')
    expect(subDoc.nodes.filter(n => n.type === 'agent').every(n => n.icon === undefined)).toBe(true)
    const fleet = subDoc.networks?.['agent-fleet']
    expect(fleet).toBeDefined()
    expect(fleet!.nodes.filter(n => n.type === 'agent')).toHaveLength(6)

    const workflow = parseDocument(groupSamples[2]!.document)
    expect(workflow.nodes.every(n => n.icon === undefined)).toBe(true)
    // Two skill pipelines, each group chaining its own stages in member order.
    const groups = workflow.groups ?? []
    expect(groups.map(g => g.label)).toEqual(['Brainstorming', 'Spec Kit'])
    expect(groups.every(g => g.expanded === true)).toBe(true)
    expect(groups.map(g => g.memberIds.length)).toEqual([8, 7])
    for (const group of groups) {
      const members = new Set(group.memberIds)
      const chain = workflow.edges.filter(e => members.has(e.from) && members.has(e.to))
      expect(chain.map(e => e.from)).toEqual(group.memberIds.slice(0, -1))
      expect(chain.map(e => e.to)).toEqual(group.memberIds.slice(1))
    }
  })

  it('registers the DSH event topology and live session sample in its own group', () => {
    const dshSamples = listSamples().filter(s => s.group === 'dsh')
    expect(dshSamples.map(s => s.id)).toEqual(['dsh-boot', 'dsh-event-topo', 'dsh-session'])

    const boot = parseDocument(dshSamples[0]!.document)
    expect(boot.meta.kind).toBe('topology')
    expect(boot.nodes.filter(n => n.id.startsWith('phase:')).length).toBeGreaterThanOrEqual(4)
    expect(boot.networks?.['network:compose']).toBeDefined()
    expect(
      Object.keys(boot.networks ?? {}).some(key => key.startsWith('network:layer:')),
    ).toBe(true)

    const sample = getSample('dsh-event-topo')
    expect(sample?.reserved).toBeUndefined()
    const doc = parseDocument(sample!.document)
    expect(doc.nodes).toHaveLength(6)
    expect(doc.edges.filter(e => e.kind === 'lifecycle')).toHaveLength(5)
    expect(doc.edges.filter(e => e.kind === 'event')).toHaveLength(4)
    // The context mounts every core plugin; the loop drives the event edges.
    const mounts = doc.edges.filter(e => e.label === 'mount').map(e => e.to)
    expect([...mounts].sort()).toEqual(
      ['agent-loop', 'llm-adapter', 'session-log', 'tool-registry'].sort(),
    )
    expect(doc.nodes.every(n => n.icon === undefined)).toBe(true)
  })

  it('registers the live DSH session sample with a parseable placeholder', () => {
    const sample = getSample('dsh-session')
    expect(sample?.live).toBe('dsh-sessions')
    const doc = parseDocument(sample!.document)
    expect(doc.meta.kind).toBe('topology')
    expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
    expect(doc.nodes.some(n => n.label === 'No dsh web connected')).toBe(true)
  })
})

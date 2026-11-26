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

  it('lists elements, adas, agents, dsh, flows in order', () => {
    const samples = listSamples()
    expect(samples[0]?.id).toBe(DEFAULT_SAMPLE_ID)
    expect(samples[0]?.group).toBe('elements')
    const groupIndexes = samples.map(s => s.group)
    const first = (group: string): number => groupIndexes.indexOf(group as never)
    const last = (group: string): number => groupIndexes.lastIndexOf(group as never)
    expect(last('elements')).toBeLessThan(first('adas'))
    expect(last('adas')).toBeLessThan(first('agents'))
    expect(last('agents')).toBeLessThan(first('dsh'))
    expect(last('dsh')).toBeLessThan(first('flows'))
    expect(samples.filter(s => s.group === 'business')).toEqual([])
  })

  it('registers element showcases', () => {
    const ids = new Set(listSamples().map(s => s.id))
    for (const id of [
      'hello-world',
      'node',
      'edge',
      'path',
      'shape-node',
      'group',
      'alarm',
      'subnetwork',
    ]) {
      expect(ids.has(id)).toBe(true)
      const sample = getSample(id)
      expect(sample?.group).toBe('elements')
      const doc = parseDocument(sample!.document)
      const count =
        doc.nodes.length
        + doc.edges.length
        + (doc.groups?.length ?? 0)
        + (doc.paths?.length ?? 0)
        + (doc.shapeNodes?.length ?? 0)
      // Edge is a full style.route catalog; other element demos stay compact.
      expect(count).toBeLessThanOrEqual(id === 'edge' ? 120 : 15)
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
    }
    const path = parseDocument(getSample('path')!.document)
    expect(path.paths?.map(p => p.id).sort()).toEqual([
      'angled-path',
      'closed-fill',
      'cubicto-curve',
      'lineto-dash',
      'lineto-open',
      'locked-path',
      'quadto-curve',
    ])
    expect(path.paths?.some(p => p.style?.shapeKind === 'quadto')).toBe(true)
    expect(path.paths?.some(p => p.style?.shapeKind === 'cubicto')).toBe(true)
    expect(path.paths?.some(p => p.closed === true && p.style?.fill !== undefined)).toBe(true)
    expect(path.paths?.some(p => p.locked === true)).toBe(true)
    expect(path.paths?.some(p => (p.angle ?? 0) !== 0)).toBe(true)
    const shapeNode = parseDocument(getSample('shape-node')!.document)
    expect(shapeNode.shapeNodes?.map(s => s.id).sort()).toEqual([
      'angled-shape',
      'closed-fill',
      'cubicto-curve',
      'in-group',
      'lineto-open',
      'locked-shape',
      'quadto-curve',
    ])
    expect(shapeNode.shapeNodes?.some(s => s.closed === false)).toBe(true)
    expect(shapeNode.shapeNodes?.some(s => s.closed === undefined && s.style?.fill !== undefined)).toBe(true)
    expect(shapeNode.shapeNodes?.some(s => s.style?.shapeKind === 'quadto')).toBe(true)
    expect(shapeNode.shapeNodes?.some(s => s.style?.shapeKind === 'cubicto')).toBe(true)
    expect(shapeNode.shapeNodes?.some(s => s.locked === true)).toBe(true)
    expect(shapeNode.shapeNodes?.some(s => (s.angle ?? 0) !== 0)).toBe(true)
    expect(shapeNode.groups?.[0]?.id).toBe('band')
    expect(shapeNode.groups?.[0]?.memberIds).toContain('in-group')
    expect(shapeNode.shapeNodes?.find(s => s.id === 'in-group')?.groupId).toBe('band')
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

  it('registers the flows group with nine flowchart samples', () => {
    const flowSamples = listSamples().filter(s => s.group === 'flows')
    expect(flowSamples.map(s => s.id)).toEqual([
      'flow-linear',
      'flow-decision',
      'flow-feedback',
      'flow-swimlane',
      'flow-fan-in',
      'flow-data',
      'flow-state',
      'flow-process',
      'flow-loop',
    ])

    for (const sample of flowSamples) {
      const doc = parseDocument(sample.document)
      expect(doc.meta.kind).toBe('flow')
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
      expect(doc.nodes.length).toBeLessThanOrEqual(9)
      expect(doc.edges.length).toBeLessThanOrEqual(12)
      expect(doc.nodes.every(n => n.data?.fill !== undefined)).toBe(true)
    }

    const swimlane = parseDocument(getSample('flow-swimlane')!.document)
    expect(swimlane.groups?.map(g => g.id).sort()).toEqual(['lane-eng', 'lane-ops'])
    expect(swimlane.groups?.every(g => g.expanded === true)).toBe(true)
    expect(swimlane.edges.some(e => e.label === 'HANDOFF')).toBe(true)

    const process = parseDocument(getSample('flow-process')!.document)
    expect(process.groups?.map(g => g.label)).toEqual([
      'Product',
      'Engineering',
      'Operations',
    ])

    const loop = parseDocument(getSample('flow-loop')!.document)
    expect(loop.nodes.some(n => n.id === 'hub')).toBe(true)
    expect(loop.edges.filter(e => e.kind === 'dep').length).toBe(5)
    expect(loop.edges.some(e => e.from === 'learn' && e.to === 'capture')).toBe(true)

    const feedback = parseDocument(getSample('flow-feedback')!.document)
    expect(feedback.edges.filter(e => e.kind === 'dep')).toHaveLength(1)
    expect(feedback.edges.find(e => e.kind === 'dep')?.style?.strokeDash).toEqual([5, 4])
  })

  it('registers the ADAS group with loadable samples and unsupported reserved rows', () => {
    const adasGroup = listSamples().filter(s => s.group === 'adas')
    expect(adasGroup.map(s => s.id)).toEqual([
      'adas-ego',
      'adas-lane-lines',
      'adas-lane-centerline',
      'adas-road-boundary',
      'adas-stop-crosswalk',
      'adas-drivable-area',
      'adas-perception-boxes',
      'adas-vru',
      'adas-traffic-signals',
      'adas-parking-slots',
      'adas-sensor-fov',
      'adas-occupancy-bev',
      'adas-planning-path',
      'adas-prediction',
      'adas-hdmap-junction',
    ])

    const reservedIds = new Set(['adas-sensor-fov'])
    const pathSampleIds = [
      'adas-lane-lines',
      'adas-lane-centerline',
      'adas-road-boundary',
      'adas-planning-path',
      'adas-prediction',
    ] as const

    for (const sample of adasGroup) {
      if (reservedIds.has(sample.id)) {
        expect(sample.reserved).toBe(true)
        parseDocument(sample.document)
        continue
      }
      expect(sample.reserved).toBeUndefined()
      const doc = parseDocument(sample.document)
      expect(doc.nodes.every(n => n.x !== undefined && n.y !== undefined)).toBe(true)
      expect(doc.nodes.every(n => n.data?.fill !== undefined)).toBe(true)
    }

    for (const id of pathSampleIds) {
      const doc = parseDocument(getSample(id)!.document)
      expect((doc.paths?.length ?? 0) >= 1).toBe(true)
      expect(doc.paths!.every(p => p.points.length >= 2)).toBe(true)
    }

    const ego = parseDocument(getSample('adas-ego')!.document)
    expect(ego.nodes.map(n => n.id)).toEqual([
      'ego-base',
      'ego-angle',
      'ego-length',
      'ego-animate',
      'ego-vector-car',
      'ego-bitmap',
    ])
    expect(ego.edges).toHaveLength(0)
    expect(ego.paths ?? []).toHaveLength(0)
    for (const id of ['ego-base', 'ego-angle', 'ego-length', 'ego-animate'] as const) {
      const node = ego.nodes.find(n => n.id === id)
      expect(node?.type).toBe('vehicle')
      expect(node?.angleAnchor).toEqual({ u: 0.5, v: 0.82 })
      expect(node?.w).toBe(40)
      expect(node?.h).toBe(80)
      expect(node?.vectorImage).toBe('demo-heading-arrow')
    }
    expect(ego.nodes.find(n => n.id === 'ego-base')?.angle).toBeUndefined()
    expect(ego.nodes.find(n => n.id === 'ego-angle')?.angle).toBe(30)
    expect(ego.nodes.find(n => n.id === 'ego-length')?.data?.speedMs).toBe(22)
    expect(ego.nodes.find(n => n.id === 'ego-animate')?.data?.vectorImagePhase).toBe(0)
    expect(ego.nodes.find(n => n.id === 'ego-vector-car')?.vectorImage).toBe('demo-ego-car-vector')
    expect(ego.nodes.find(n => n.id === 'ego-bitmap')?.vectorImage).toBe('demo-ego-car-bitmap')

    const boxes = parseDocument(getSample('adas-perception-boxes')!.document)
    expect(boxes.nodes.some(n => n.data?.class === 'truck')).toBe(true)

    const parking = parseDocument(getSample('adas-parking-slots')!.document)
    expect(parking.groups?.map(g => g.id).sort()).toEqual([
      'slot-1',
      'slot-2',
      'slot-3',
      'slot-4',
    ])

    const occ = parseDocument(getSample('adas-occupancy-bev')!.document)
    expect(occ.nodes.filter(n => n.type === 'occupancy')).toHaveLength(48)

    const junction = parseDocument(getSample('adas-hdmap-junction')!.document)
    expect(junction.edges.filter(e => e.kind === 'successor').length).toBeGreaterThanOrEqual(4)
  })
})




import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'

function loadScene(): GraphScene {
  const scene = new GraphScene()
  scene.load({
    version: 1,
    nodes: [
      { id: 'a', type: 'agent', label: 'A', x: 0, y: 0, w: 100, h: 40 },
      { id: 'b', type: 'agent', label: 'B', x: 200, y: 0, w: 100, h: 40 },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b' }],
    groups: [{ id: 'g1', label: 'G', memberIds: ['a'], x: -10, y: -10, w: 140, h: 80, expanded: true }],
  })
  return scene
}

describe('ViewSet', () => {
  it('rebuild creates one view per node/edge/group', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    expect(views.getNode('a')).toBeDefined()
    expect(views.getNode('b')).toBeDefined()
    expect(views.getEdge('e1')).toBeDefined()
    expect(views.getGroup('g1')).toBeDefined()
  })

  it('markNodeGeometryDirty dirties incident edges', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const edge = views.getEdge('e1')!
    const before = edge.bounds
    views.markNodeGeometryDirty(scene, 'a')
    scene.writePositions({ a: { x: 50, y: 10 } })
    views.validateDirty(scene)
    expect(edge.bounds).not.toEqual(before)
    expect(views.getNode('a')!.bounds.x).toBe(50)
  })

  it('markNodeGeometryDirty refreshes group-endpoint edges when a member moves', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'agent', label: 'A', x: 100, y: 100, w: 50, h: 50, groupId: 'g1' },
        { id: 'b', type: 'agent', label: 'B', x: 200, y: 100, w: 50, h: 50, groupId: 'g1' },
        { id: 'out', type: 'agent', label: 'Out', x: 400, y: 100, w: 50, h: 50 },
      ],
      edges: [{ id: 'eg', from: 'g1', to: 'out' }],
      groups: [{
        id: 'g1',
        label: 'G',
        memberIds: ['a', 'b'],
        expanded: true,
        x: 80,
        y: 80,
      }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const edge = views.getEdge('eg')!
    const fromBefore = edge.points[0]!
    scene.writePositions({ a: { x: 100, y: 250 } })
    views.markNodeGeometryDirty(scene, 'a')
    views.validateDirty(scene)
    const fromAfter = edge.points[0]!
    expect(fromAfter.y).toBeGreaterThan(fromBefore.y)
  })

  it('validate is idempotent until markDirty', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const node = views.getNode('a')!
    const first = node.bounds
    views.validateDirty(scene)
    expect(node.bounds).toBe(first)
    views.markDirty('a')
    scene.writePositions({ a: { x: 12, y: 0 } })
    views.validateDirty(scene)
    expect(node.bounds.x).toBe(12)
    expect(node.bounds).not.toBe(first)
  })

  it('caches attachment paint ops on validate', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'VeryLongAgentLabelXYZ',
        status: 'idle',
        x: 0,
        y: 0,
        w: 100,
        h: 40,
        alarms: [{ id: 'al1', level: 'error', message: 'boom' }],
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const paint = views.getNode('a')!.toPaintView(false, false)
    const label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe('VeryLongAgentLabelXYZ')
    expect(paint.attachments.some(op => op.kind === 'alarm')).toBe(true)
    expect(paint.circular).toBe(false)
    // status is not auto-mapped to label2
    expect(paint.attachments.some(op => op.kind === 'label2')).toBe(false)
  })

  it('sync after remove disposes missing ids', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    scene.apply({ ops: [{ op: 'removeNode', id: 'b' }] })
    if (scene.edges.has('e1')) {
      scene.apply({ ops: [{ op: 'removeEdge', id: 'e1' }] })
    }
    views.sync(scene)
    expect(views.getNode('b')).toBeUndefined()
    expect(views.getEdge('e1')).toBeUndefined()
    expect(views.getNode('a')).toBeDefined()
  })

  it('exposes edge route points for hit-test reuse', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const edge = views.getEdge('e1')!
    const first = edge.points
    expect(first.length).toBeGreaterThanOrEqual(2)
    views.validateDirty(scene)
    expect(edge.points).toBe(first)
    views.markDirty('e1')
    scene.writePositions({ a: { x: 40, y: 0 } })
    views.markNodeGeometryDirty(scene, 'a')
    views.validateDirty(scene)
    expect(edge.points).not.toBe(first)
  })
})

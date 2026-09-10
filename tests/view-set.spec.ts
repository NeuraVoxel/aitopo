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
    groups: [{ id: 'g1', label: 'G', memberIds: ['a'], x: -10, y: -10, w: 140, h: 80 }],
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

  it('sync after remove disposes missing ids', () => {
    const scene = loadScene()
    const views = new ViewSet()
    views.rebuild(scene)
    scene.apply({ ops: [{ op: 'removeNode', id: 'b' }] })
    // removeNode may leave dangling edge depending on patch rules — remove edge too if needed
    if (scene.edges.has('e1')) {
      scene.apply({ ops: [{ op: 'removeEdge', id: 'e1' }] })
    }
    views.sync(scene)
    expect(views.getNode('b')).toBeUndefined()
    expect(views.getEdge('e1')).toBeUndefined()
    expect(views.getNode('a')).toBeDefined()
  })
})

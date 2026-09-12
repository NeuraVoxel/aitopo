import { describe, expect, it, vi } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { DirtyAccumulator } from '../src/network/dirty.ts'
import { GestureEditor } from '../src/network/gesture-editor.ts'
import { ViewSet } from '../src/ui/view-set.ts'
import type { GraphEvent } from '../src/protocol/events.ts'
import type { GraphPatch } from '../src/protocol/patch.ts'

describe('GestureEditor', () => {
  it('commits node move and membership via apply/emit deps', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 10, y: 20, groupId: 'g1' },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 20 },
      ],
      edges: [],
      groups: [
        { id: 'g1', label: 'G1', memberIds: ['a'], x: 0, y: 0, w: 120, h: 80 },
        { id: 'g2', label: 'G2', memberIds: [], x: 180, y: 0, w: 120, h: 80 },
      ],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const dirty = new DirtyAccumulator()
    const events: GraphEvent[] = []
    const apply = vi.fn((patch: GraphPatch) => {
      scene.apply(patch)
    })
    const editor = new GestureEditor({
      scene,
      views,
      dirty,
      scheduleScenePaint: vi.fn(),
      apply,
      emit: event => {
        events.push(event)
      },
    })

    editor.commitNodeMove({
      nodeId: 'a',
      from: { x: 10, y: 20 },
      to: { x: 190, y: 30 },
      toGroupId: 'g2',
    })

    expect(apply).toHaveBeenCalled()
    expect(scene.nodes.get('a')).toMatchObject({ x: 190, y: 30, groupId: 'g2' })
    expect(events.some(e => e.type === 'nodeMoved')).toBe(true)
    expect(events.some(e => e.type === 'groupMembershipChanged')).toBe(true)
  })

  it('skips duplicate edge create', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'unit', label: 'B', x: 100, y: 0 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    const editor = new GestureEditor({
      scene,
      views,
      dirty: new DirtyAccumulator(),
      scheduleScenePaint: vi.fn(),
      apply: vi.fn(),
      emit: vi.fn(),
    })
    expect(editor.commitEdgeCreate({ from: 'a', to: 'b' })).toBeUndefined()
  })

  it('commits edge waypoints and emits edgeWaypointsChanged', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'unit', label: 'B', x: 100, y: 0 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const events: GraphEvent[] = []
    const apply = vi.fn((patch: GraphPatch) => {
      scene.apply(patch)
    })
    const editor = new GestureEditor({
      scene,
      views,
      dirty: new DirtyAccumulator(),
      scheduleScenePaint: vi.fn(),
      apply,
      emit: event => {
        events.push(event)
      },
    })
    const to = [{ x: 40, y: 30 }, { x: 60, y: 30 }]
    editor.commitEdgeWaypoints({ edgeId: 'e1', from: [], to })
    expect(apply).toHaveBeenCalled()
    expect(scene.edges.get('e1')?.waypoints).toEqual(to)
    expect(scene.toJSON().edges[0]?.waypoints).toEqual(to)
    expect(events).toContainEqual({
      type: 'edgeWaypointsChanged',
      edgeId: 'e1',
      from: [],
      to,
    })
  })

  it('tracks gesture drag flag', () => {
    const scene = new GraphScene()
    scene.load({ version: 1, nodes: [], edges: [] })
    const editor = new GestureEditor({
      scene,
      views: new ViewSet(),
      dirty: new DirtyAccumulator(),
      scheduleScenePaint: vi.fn(),
      apply: vi.fn(),
      emit: vi.fn(),
    })
    expect(editor.wasGestureDragged()).toBe(false)
    editor.markGestureDragged()
    expect(editor.wasGestureDragged()).toBe(true)
    editor.clearGestureDragged()
    expect(editor.wasGestureDragged()).toBe(false)
  })

  it('preview move inside an auto-fit band dirties the band old and new rects', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 100, y: 100, groupId: 'g1' }],
      edges: [],
      groups: [
        { id: 'g1', label: 'G1', memberIds: ['a'], x: 84, y: 84, expanded: true },
      ],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const dirty = new DirtyAccumulator()
    const editor = new GestureEditor({
      scene,
      views,
      dirty,
      scheduleScenePaint: vi.fn(),
      apply: vi.fn(),
      emit: vi.fn(),
    })

    editor.previewNodePosition('a', 300, 100)

    const union = dirty.rect
    expect(union).toBeDefined()
    // Band = member union (50x50 default body) + 16px padding, so the old band
    // occupies (84, 84)-(166, 166) and the new one (284, 84)-(366, 166). Each
    // 8px-grown band corner must fall inside the dirty union or the repaint
    // clip leaves band ghosts.
    for (const corner of [
      { x: 76, y: 76 },
      { x: 174, y: 174 },
      { x: 276, y: 76 },
      { x: 374, y: 174 },
    ]) {
      expect(containsPoint(union!, corner)).toBe(true)
    }
  })
})

function containsPoint(
  rect: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height
}

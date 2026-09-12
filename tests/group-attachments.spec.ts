/**
 * Group attachment / expand-collapse / auto-fit behavior.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { groupBounds } from '../src/ui/bounds.ts'
import {
  computeExpandedBandBounds,
  expandCollapseCenterPatches,
  rectCenter,
} from '../src/ui/group-state.ts'
import { ViewSet } from '../src/ui/view-set.ts'

function loadGroupDoc(opts: {
  expanded?: boolean
  style?: Record<string, unknown>
  groupExtra?: Record<string, unknown>
  edge?: boolean
} = {}) {
  const scene = new GraphScene()
  scene.load({
    version: 1,
    nodes: [
      { id: 'a', type: 'agent', label: 'A', x: 100, y: 100, w: 50, h: 50, groupId: 'g1' },
      { id: 'b', type: 'agent', label: 'B', x: 200, y: 100, w: 50, h: 50, groupId: 'g1' },
      { id: 'c', type: 'agent', label: 'C', x: 400, y: 100, w: 50, h: 50 },
    ],
    edges: opts.edge === false
      ? []
      : [
        { id: 'inner', from: 'a', to: 'b' },
        { id: 'cross', from: 'a', to: 'c' },
      ],
    groups: [{
      id: 'g1',
      label: 'Band',
      memberIds: ['a', 'b'],
      x: 80,
      y: 80,
      ...(opts.expanded !== undefined ? { expanded: opts.expanded } : {}),
      ...(opts.style !== undefined ? { style: opts.style } : {}),
      ...(opts.groupExtra ?? {}),
    }],
  })
  const views = new ViewSet()
  views.rebuild(scene)
  views.validateDirty(scene)
  return { scene, views }
}

describe('Group attachments and expand/collapse', () => {
  it('defaults to collapsed node body 50×50 with group icon', () => {
    const { views } = loadGroupDoc()
    const group = views.getGroup('g1')!
    expect(group.isExpanded).toBe(false)
    expect(group.bandBounds.width).toBe(50)
    expect(group.bandBounds.height).toBe(50)
    expect(views.getNode('a')!.isVisible).toBe(false)
    const paint = group.toPaintView(false, false)
    expect(paint.attachments.some(op => op.kind === 'icons')).toBe(true)
    expect(paint.attachments.some(op => op.kind === 'label')).toBe(true)
  })

  it('does not truncate group labels by default; honors style.label.maxChars', () => {
    const long = 'VeryLongGroupLabelWithoutEllipsisXYZ'
    const { scene, views } = loadGroupDoc({
      groupExtra: { label: long },
    })
    let paint = views.getGroup('g1')!.toPaintView(false, false)
    let label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe(long)
    scene.apply({
      ops: [{
        op: 'updateGroup',
        id: 'g1',
        patch: { style: { label: { maxChars: 10 } } },
      }],
    })
    views.markDirty('g1')
    views.validateDirty(scene)
    paint = views.getGroup('g1')!.toPaintView(false, false)
    label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe('VeryLongG…')
  })

  it('honors collapsed w/h overrides', () => {
    const { views } = loadGroupDoc({ groupExtra: { w: 72, h: 64 } })
    const band = views.getGroup('g1')!.bandBounds
    expect(band.width).toBe(72)
    expect(band.height).toBe(64)
  })

  it('defaults to collapsed and hides members', () => {
    const { views } = loadGroupDoc()
    expect(views.getGroup('g1')!.isExpanded).toBe(false)
    expect(views.getNode('a')!.isVisible).toBe(false)
    expect(views.getNode('b')!.isVisible).toBe(false)
    expect(views.getNode('c')!.isVisible).toBe(true)
  })

  it('expands via updateGroup and auto-fits band around members', () => {
    const { scene, views } = loadGroupDoc()
    scene.apply({ ops: [{ op: 'updateGroup', id: 'g1', patch: { expanded: true } }] })
    views.markGroupGeometryDirty(scene, 'g1')
    views.validateDirty(scene)
    const group = views.getGroup('g1')!
    expect(group.isExpanded).toBe(true)
    expect(views.getNode('a')!.isVisible).toBe(true)
    const band = group.bandBounds
    expect(band.x).toBeLessThanOrEqual(100)
    expect(band.y).toBeLessThanOrEqual(100)
    expect(band.x + band.width).toBeGreaterThanOrEqual(250)
    expect(band.y + band.height).toBeGreaterThanOrEqual(150)
  })

  it('emits label/label2/alarm attachment ops and dual bounds', () => {
    const { views } = loadGroupDoc({
      expanded: true,
      groupExtra: {
        label2: 'sec',
        alarms: [{ id: 'al', level: 'error', message: 'down' }],
      },
    })
    const view = views.getGroup('g1')!
    const paint = view.toPaintView(false, false)
    const kinds = paint.attachments.map(op => op.kind)
    expect(kinds).toContain('label')
    expect(kinds).toContain('label2')
    expect(kinds).toContain('alarm')
    expect(view.unionBounds.height).toBeGreaterThanOrEqual(view.bandBounds.height)
  })

  it('hides intra-group edges and remaps cross edges when collapsed', () => {
    const { views } = loadGroupDoc()
    expect(views.getEdge('inner')!.isActive).toBe(false)
    expect(views.getEdge('cross')!.isActive).toBe(true)
    const cross = views.getEdge('cross')!
    const group = views.getGroup('g1')!
    // From-anchor should sit on the collapsed group band, not hidden node a.
    expect(cross.points[0]!.x).toBeGreaterThanOrEqual(group.bandBounds.x - 1)
    expect(cross.points[0]!.x).toBeLessThanOrEqual(
      group.bandBounds.x + group.bandBounds.width + 1,
    )
  })

  it('applies style.alpha and merges style one level', () => {
    const { scene, views } = loadGroupDoc({
      expanded: true,
      style: { stroke: '#111', alpha: 0.5 },
    })
    let paint = views.getGroup('g1')!.toPaintView(false, false)
    expect(paint.alpha).toBe(0.5)
    expect(paint.stroke).toBe('#111')
    scene.apply({
      ops: [{ op: 'updateGroup', id: 'g1', patch: { style: { fill: '#abc' } } }],
    })
    views.markDirty('g1')
    views.validateDirty(scene)
    paint = views.getGroup('g1')!.toPaintView(false, false)
    expect(paint.stroke).toBe('#111')
    expect(paint.fill).toBe('#abc')
  })

  it('honors autoFit false by keeping document geometry when expanded', () => {
    const { views } = loadGroupDoc({
      expanded: true,
      style: { autoFit: false },
      groupExtra: { w: 100, h: 80 },
    })
    const band = views.getGroup('g1')!.bandBounds
    expect(band.x).toBe(80)
    expect(band.y).toBe(80)
    expect(band.width).toBe(100)
    expect(band.height).toBe(80)
  })

  it('toggles expanded via updateGroup patch (dblclick apply path)', () => {
    const { scene, views } = loadGroupDoc({ expanded: true })
    expect(views.getGroup('g1')!.isExpanded).toBe(true)
    scene.apply({ ops: [{ op: 'updateGroup', id: 'g1', patch: { expanded: false } }] })
    views.markGroupGeometryDirty(scene, 'g1')
    views.validateDirty(scene)
    expect(views.getGroup('g1')!.isExpanded).toBe(false)
    expect(views.getNode('a')!.isVisible).toBe(false)
    scene.apply({ ops: [{ op: 'updateGroup', id: 'g1', patch: { expanded: true } }] })
    views.markGroupGeometryDirty(scene, 'g1')
    views.validateDirty(scene)
    expect(views.getGroup('g1')!.isExpanded).toBe(true)
    expect(views.getNode('a')!.isVisible).toBe(true)
  })

  it('collapse parks body at expanded band center; expand recenters members', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'agent', label: 'A', x: 100, y: 100, w: 50, h: 50, groupId: 'g1' },
        { id: 'b', type: 'agent', label: 'B', x: 200, y: 100, w: 50, h: 50, groupId: 'g1' },
      ],
      edges: [],
      groups: [{
        id: 'g1',
        label: 'G',
        memberIds: ['a', 'b'],
        expanded: true,
        x: 0,
        y: 0,
      }],
    })
    const group = scene.groups.get('g1')!
    const bandCenter = rectCenter(computeExpandedBandBounds(scene, group))
    const collapse = expandCollapseCenterPatches(scene, group, false)
    expect(collapse.groupPatch.expanded).toBe(false)
    const collapsedBody = groupBounds({
      ...group,
      x: collapse.groupPatch.x,
      y: collapse.groupPatch.y,
      expanded: false,
    })
    expect(rectCenter(collapsedBody).x).toBeCloseTo(bandCenter.x)
    expect(rectCenter(collapsedBody).y).toBeCloseTo(bandCenter.y)

    scene.apply({
      ops: [{
        op: 'updateGroup',
        id: 'g1',
        patch: collapse.groupPatch,
      }],
    })
    // Drag the collapsed node away without moving members (simulate desync).
    scene.apply({
      ops: [{ op: 'updateGroup', id: 'g1', patch: { x: 500, y: 400 } }],
    })
    const collapsed = scene.groups.get('g1')!
    const expand = expandCollapseCenterPatches(scene, collapsed, true)
    expect(expand.memberMoves.length).toBe(2)
    const target = rectCenter(groupBounds(collapsed))
    scene.apply({
      ops: [
        { op: 'updateGroup', id: 'g1', patch: expand.groupPatch },
        ...expand.memberMoves.map(m => ({
          op: 'updateNode' as const,
          id: m.id,
          patch: { x: m.to.x, y: m.to.y },
        })),
      ],
    })
    const after = scene.groups.get('g1')!
    const newBand = computeExpandedBandBounds(scene, { ...after, expanded: true })
    expect(rectCenter(newBand).x).toBeCloseTo(target.x)
    expect(rectCenter(newBand).y).toBeCloseTo(target.y)
  })
})

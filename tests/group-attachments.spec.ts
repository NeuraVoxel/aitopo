/**
 * Group attachment / expand-collapse / auto-fit behavior.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { groupBounds } from '../src/ui/bounds.ts'
import {
  computeExpandedBandBounds,
  DEFAULT_GROUP_PADDING,
  expandCollapseCenterPatches,
  rectCenter,
  suggestedGroupTopPadding,
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
    // Collapsed body matches the default node look: near-black fill, slate stroke.
    expect(paint.fill).toBe('#1a1d24')
    expect(paint.stroke).toBe('#334155')
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

  it('defaults label to top outside the body when collapsed and expanded', () => {
    for (const expanded of [false, true] as const) {
      const { views } = loadGroupDoc({ expanded })
      const view = views.getGroup('g1')!
      const paint = view.toPaintView(false, false)
      const label = paint.attachments.find(op => op.kind === 'label')
      expect(label && 'bounds' in label).toBe(true)
      if (label === undefined || !('bounds' in label)) return
      expect(label.bounds.y + label.bounds.height).toBeLessThanOrEqual(view.bandBounds.y)
    }
  })

  it('honors labelPosition insideTopLeft inside the band body', () => {
    const { views } = loadGroupDoc({
      expanded: true,
      style: { labelPosition: 'insideTopLeft' },
      groupExtra: { label: 'Inside' },
    })
    const view = views.getGroup('g1')!
    const paint = view.toPaintView(false, false)
    const label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'bounds' in label).toBe(true)
    if (label === undefined || !('bounds' in label)) return
    const band = view.bandBounds
    expect(label.bounds.x).toBeGreaterThanOrEqual(band.x)
    expect(label.bounds.y).toBeGreaterThanOrEqual(band.y)
    expect(label.bounds.x + label.bounds.width).toBeLessThanOrEqual(band.x + band.width)
    expect(label.bounds.y + label.bounds.height).toBeLessThanOrEqual(band.y + band.height)
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

  it('auto-fit band wraps member paint extents (labels below bodies), not bare bodies', () => {
    const { views } = loadGroupDoc({ expanded: true })
    const nodeA = views.getNode('a')!
    // Label 'A' hangs below the body, so the paint union is taller than the body.
    expect(nodeA.unionBounds.y + nodeA.unionBounds.height)
      .toBeGreaterThan(nodeA.bodyBounds.y + nodeA.bodyBounds.height)
    const band = views.getGroup('g1')!.bandBounds
    // The band is the member paint union grown by the default padding.
    expect(band.y).toBeLessThanOrEqual(nodeA.unionBounds.y - DEFAULT_GROUP_PADDING)
    expect(band.y + band.height)
      .toBeGreaterThanOrEqual(nodeA.unionBounds.y + nodeA.unionBounds.height + DEFAULT_GROUP_PADDING)
    // Body-only band would stop at body bottom + padding (150 + 16).
    expect(band.y + band.height).toBeGreaterThan(150 + DEFAULT_GROUP_PADDING)
  })

  it('scene-only band helpers stay body-only; a member-bounds resolver widens to paint extents', () => {
    const { scene, views } = loadGroupDoc({ expanded: true })
    const group = scene.groups.get('g1')!
    const bodyOnly = computeExpandedBandBounds(scene, group)
    const painted = computeExpandedBandBounds(scene, group, n => views.nodeUnionBounds(n))
    // Bare bodies: 100..150 vertically, plus padding both sides.
    expect(bodyOnly.y).toBe(100 - DEFAULT_GROUP_PADDING)
    expect(bodyOnly.y + bodyOnly.height).toBe(150 + DEFAULT_GROUP_PADDING)
    expect(painted.height).toBeGreaterThan(bodyOnly.height)
    expect(painted.y + painted.height).toBe(views.getGroup('g1')!.bandBounds.y + views.getGroup('g1')!.bandBounds.height)
  })

  it('honors explicit paddingTop without changing the uniform padding default', () => {
    const { scene } = loadGroupDoc({
      expanded: true,
      style: { paddingTop: 40 },
    })
    const group = scene.groups.get('g1')!
    expect(suggestedGroupTopPadding(group)).toBeGreaterThan(DEFAULT_GROUP_PADDING)
    const band = computeExpandedBandBounds(scene, group)
    expect(band.y).toBe(100 - 40)
    expect(band.y + band.height).toBe(150 + DEFAULT_GROUP_PADDING)
  })

  it('collapse parks the body at the painted band center (attachments included)', () => {
    const { scene, views } = loadGroupDoc({ expanded: true })
    const group = scene.groups.get('g1')!
    const paintedBand = views.getGroup('g1')!.bandBounds
    const collapse = expandCollapseCenterPatches(
      scene,
      group,
      false,
      n => views.nodeUnionBounds(n),
    )
    const parked = rectCenter(groupBounds({
      ...group,
      x: collapse.groupPatch.x,
      y: collapse.groupPatch.y,
    }))
    expect(parked.x).toBeCloseTo(rectCenter(paintedBand).x)
    expect(parked.y).toBeCloseTo(rectCenter(paintedBand).y)
    // Body-only collapse would park higher: labels hang below, shifting the center down.
    const bodyOnly = expandCollapseCenterPatches(scene, group, false)
    expect(parked.y).toBeGreaterThan(bodyOnly.groupPatch.y!)
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

/**
 * Nested GraphGroup: parentId, visibility, agent remap, auto-fit, cycle reject.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { parseDocument } from '../src/protocol/parse.ts'
import {
  collapsedGroupForNode,
  computeExpandedBandBounds,
  isGroupVisibleInScene,
  isNodeVisibleInScene,
} from '../src/ui/group-state.ts'
import { ViewSet } from '../src/ui/view-set.ts'

function loadNested() {
  const scene = new GraphScene()
  scene.load({
    version: 1,
    nodes: [
      { id: 'p1', type: 'component', label: '数据管理', x: 100, y: 100, w: 80, h: 40, groupId: 'apps' },
      { id: 'p2', type: 'component', label: '标注', x: 200, y: 100, w: 80, h: 40, groupId: 'apps' },
      { id: 'ota', type: 'component', label: 'OTA', x: 100, y: 220, w: 120, h: 48, groupId: 'g-apps' },
      { id: 'out', type: 'component', label: 'Out', x: 400, y: 100, w: 50, h: 50 },
    ],
    edges: [
      { id: 'cross', from: 'p1', to: 'out' },
    ],
    groups: [
      {
        id: 'apps',
        label: '应用层',
        memberIds: ['p1', 'p2'],
        parentId: 'g-apps',
        expanded: false,
        x: 100,
        y: 100,
        w: 160,
        h: 64,
      },
      {
        id: 'g-apps',
        label: '应用平台',
        memberIds: ['apps', 'ota'],
        expanded: true,
        x: 80,
        y: 80,
        w: 200,
        h: 200,
        style: { paddingTop: 36 },
      },
    ],
  })
  const views = new ViewSet()
  views.rebuild(scene)
  views.validateDirty(scene)
  return { scene, views }
}

describe('Nested groups', () => {
  it('hides inner group and members when the outer group is collapsed', () => {
    const { scene, views } = loadNested()
    scene.apply({
      ops: [{ op: 'updateGroup', id: 'g-apps', patch: { expanded: false } }],
    })
    views.markGroupGeometryDirty(scene, 'g-apps')
    views.validateDirty(scene)
    expect(isGroupVisibleInScene(scene, 'apps')).toBe(false)
    expect(isNodeVisibleInScene(scene, 'p1')).toBe(false)
    expect(isNodeVisibleInScene(scene, 'ota')).toBe(false)
    expect(views.getGroup('apps')!.isVisible).toBe(false)
  })

  it('remaps agent links to the nearest collapsed ancestor', () => {
    const { scene, views } = loadNested()
    // Inner collapsed, outer expanded → remap to apps
    expect(collapsedGroupForNode(scene, 'p1')?.id).toBe('apps')
    const edge = views.getEdge('cross')!
    expect(edge.isActive).toBe(true)
    // Collapse outer → nearest collapsed while walking up is still apps first...
    // Wait: apps is collapsed, so nearest is apps even if outer also collapses.
    scene.apply({
      ops: [{ op: 'updateGroup', id: 'g-apps', patch: { expanded: false } }],
    })
    expect(collapsedGroupForNode(scene, 'p1')?.id).toBe('apps')
    // Expand inner while outer collapsed: walk apps (expanded) → g-apps (collapsed)
    scene.apply({
      ops: [
        { op: 'updateGroup', id: 'apps', patch: { expanded: true } },
        { op: 'updateGroup', id: 'g-apps', patch: { expanded: false } },
      ],
    })
    expect(collapsedGroupForNode(scene, 'p1')?.id).toBe('g-apps')
  })

  it('includes the child group band in the outer auto-fit union', () => {
    const { scene } = loadNested()
    scene.apply({
      ops: [{ op: 'updateGroup', id: 'apps', patch: { expanded: true } }],
    })
    const band = computeExpandedBandBounds(scene, scene.groups.get('g-apps')!)
    // Must cover platform nodes and ota
    expect(band.x).toBeLessThanOrEqual(100)
    expect(band.y).toBeLessThanOrEqual(100)
    expect(band.x + band.width).toBeGreaterThanOrEqual(280)
    expect(band.y + band.height).toBeGreaterThanOrEqual(268)
  })

  it('rejects parentId cycles at parse time', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [
        { id: 'a', label: 'A', memberIds: ['b'], parentId: 'b' },
        { id: 'b', label: 'B', memberIds: [], parentId: 'a' },
      ],
    })).toThrow(/cycle/)
  })

  it('ignores non-complementary corridor waypoints while collapse-remapped', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'inner', type: 'component', label: 'In', x: 100, y: 100, w: 80, h: 40, groupId: 'g' },
        { id: 'out', type: 'component', label: 'Out', x: 400, y: 200, w: 50, h: 50 },
      ],
      edges: [{
        id: 'e',
        from: 'out',
        to: 'inner',
        fromAnchor: 'left',
        toAnchor: 'right',
        // Authored for the expanded layout — must not drive the collapsed path.
        waypoints: [{ x: 300, y: 300 }, { x: 180, y: 300 }],
      }],
      groups: [{
        id: 'g',
        label: 'Band',
        memberIds: ['inner'],
        expanded: false,
        x: 100,
        y: 100,
        w: 120,
        h: 64,
      }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const pts = views.getEdge('e')!.points
    expect(pts.some(p => p.y === 300)).toBe(false)
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]!
      const b = pts[i]!
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
    // Document waypoints remain for when the group expands again.
    expect(scene.edges.get('e')!.waypoints).toEqual([
      { x: 300, y: 300 },
      { x: 180, y: 300 },
    ])
  })
})

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphScene } from '../src/model/index.ts'
import { Network } from '../src/network/network.ts'
import { applyPatch, invertPatch, parseDocument } from '../src/protocol/index.ts'
import type { GraphEvent } from '../src/protocol/events.ts'
import type { GraphShapeNode } from '../src/protocol/types.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { computeExpandedBandBounds } from '../src/ui/group-state.ts'
import { ShapeNodeView } from '../src/ui/shape-node-view.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('GraphShapeNode protocol', () => {
  it('defaults omitted shapeNodes to empty array', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
    })
    expect(doc.shapeNodes ?? []).toEqual([])
  })

  it('accepts a closed lineto polygon with three or more points', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 20, y: 30 },
        ],
        style: { fill: '#e2e8f0', stroke: '#334155', shapeKind: 'lineto' },
      }],
    })
    expect(doc.shapeNodes).toHaveLength(1)
    expect(doc.shapeNodes![0]!.id).toBe('sn1')
    // Omitted closed ≡ closed for ShapeNode (opposite of Path).
    expect(doc.shapeNodes![0]!.closed).toBeUndefined()
  })

  it('accepts explicit closed: true', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 20, y: 30 },
        ],
        closed: true,
        style: { fill: '#e2e8f0', shapeKind: 'lineto' },
      }],
    })
    expect(doc.shapeNodes![0]!.closed).toBe(true)
  })

  it('accepts open shapeNode with closed: false', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'open',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        closed: false,
        style: { stroke: '#334155', shapeKind: 'lineto' },
      }],
    })
    expect(doc.shapeNodes![0]!.closed).toBe(false)
  })

  it('accepts shapeNode with groupId, label2, and alarms', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [{ id: 'g1', label: 'G', memberIds: ['sn-member'] }],
      shapeNodes: [{
        id: 'sn-member',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
        groupId: 'g1',
        label: 'Slot',
        label2: 'P1',
        alarms: [{ id: 'a1', level: 'warn', message: 'busy' }],
      }],
    })
    const sn = doc.shapeNodes![0]!
    expect(sn.groupId).toBe('g1')
    expect(sn.label2).toBe('P1')
    expect(sn.alarms).toHaveLength(1)
  })

  it('accepts quadto with odd point count ≥ 3', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'q1',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: -20 },
          { x: 100, y: 0 },
        ],
        style: { shapeKind: 'quadto' },
      }],
    })
    expect(doc.shapeNodes![0]!.style?.shapeKind).toBe('quadto')
  })

  it('accepts cubicto with point count ≡ 1 mod 3 and ≥ 4', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'c1',
        points: [
          { x: 0, y: 0 },
          { x: 30, y: -40 },
          { x: 70, y: -40 },
          { x: 100, y: 0 },
        ],
        style: { shapeKind: 'cubicto' },
      }],
    })
    expect(doc.shapeNodes![0]!.style?.shapeKind).toBe('cubicto')
  })

  it('rejects shapeNode with fewer than two points', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{ id: 'sn1', points: [{ x: 0, y: 0 }] }],
    })).toThrow()
  })

  it('rejects quadto with even point count', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'q-bad',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: -20 },
          { x: 100, y: 0 },
          { x: 150, y: 10 },
        ],
        style: { shapeKind: 'quadto' },
      }],
    })).toThrow()
  })

  it('rejects cubicto with point count not ≡ 1 mod 3', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'c-bad',
        points: [
          { x: 0, y: 0 },
          { x: 30, y: -40 },
          { x: 100, y: 0 },
        ],
        style: { shapeKind: 'cubicto' },
      }],
    })).toThrow()
  })

  it('rejects shapeNode id that collides with a node id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'same', type: 'n', label: 'N', x: 0, y: 0 }],
      edges: [],
      shapeNodes: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects shapeNode id that collides with a path id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
      shapeNodes: [{ id: 'same', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] }],
    })).toThrow()
  })

  it('rejects shapeNode id that collides with an edge id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'n', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'n', label: 'B', x: 10, y: 0 },
      ],
      edges: [{ id: 'same', from: 'a', to: 'b' }],
      shapeNodes: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects shapeNode id that collides with a group id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [{ id: 'same', label: 'G', memberIds: [] }],
      shapeNodes: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects duplicate shapeNode ids in the same document', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [
        { id: 'dup', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
        { id: 'dup', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] },
      ],
    })).toThrow(/duplicate shapeNode id/)
  })

  it('GraphShapeNode type accepts the protocol fields', () => {
    const shapeNode: GraphShapeNode = {
      id: 'typed',
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      closed: true,
      label: 'L',
      label2: 'L2',
      tooltip: 'tip',
      locked: false,
      groupId: 'g1',
      alarms: [],
      style: {
        stroke: '#000',
        lineWidth: 1,
        strokeDash: [2, 2],
        fill: '#fff',
        alpha: 0.9,
        shapeKind: 'lineto',
      },
      data: { k: 1 },
    }
    expect(shapeNode.id).toBe('typed')
  })

  it('addShapeNode / updateShapeNode / removeShapeNode round-trip with invert', () => {
    const empty = parseDocument({ version: 1, nodes: [], edges: [] })
    const added = applyPatch(empty, {
      ops: [{
        op: 'addShapeNode',
        shapeNode: {
          id: 'sn1',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
        },
      }],
    })
    expect(added.shapeNodes).toHaveLength(1)
    const updated = applyPatch(added, {
      ops: [{
        op: 'updateShapeNode',
        id: 'sn1',
        patch: {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 5 },
            { x: 40, y: 0 },
            { x: 20, y: 30 },
          ],
        },
      }],
    })
    expect(updated.shapeNodes![0]!.points).toHaveLength(4)
    const inverse = invertPatch(added, {
      ops: [{
        op: 'updateShapeNode',
        id: 'sn1',
        patch: {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 5 },
            { x: 40, y: 0 },
            { x: 20, y: 30 },
          ],
        },
      }],
    })
    const back = applyPatch(updated, { ops: inverse })
    expect(back.shapeNodes![0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
    const removed = applyPatch(added, { ops: [{ op: 'removeShapeNode', id: 'sn1' }] })
    expect(removed.shapeNodes ?? []).toEqual([])
  })

  it('addShapeNode fails on duplicate id', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'addShapeNode',
        shapeNode: {
          id: 'sn1',
          points: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 2 }],
        },
      }],
    })).toThrow(/duplicate/)
  })

  it('addShapeNode rejects path id collision', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'shared', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'addShapeNode',
        shapeNode: {
          id: 'shared',
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        },
      }],
    })).toThrow(/path/)
  })

  it('updateShapeNode / removeShapeNode fail on missing id', () => {
    const empty = parseDocument({ version: 1, nodes: [], edges: [] })
    expect(() => applyPatch(empty, {
      ops: [{
        op: 'updateShapeNode',
        id: 'missing',
        patch: { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
      }],
    })).toThrow(/missing/)
    expect(() => applyPatch(empty, {
      ops: [{ op: 'removeShapeNode', id: 'missing' }],
    })).toThrow(/missing/)
  })

  it('updateShapeNode rejects invalid points arity via schema', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'updateShapeNode',
        id: 'sn1',
        patch: { points: [{ x: 0, y: 0 }] },
      }],
    })).toThrow(/points\.length/)
  })

  it('updateShapeNode points that violate existing quadto shapeKind throws', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: -20 },
          { x: 100, y: 0 },
        ],
        style: { shapeKind: 'quadto' },
      }],
    })
    // Patch fragment alone is valid lineto (≥2); merged state must still honor quadto.
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'updateShapeNode',
        id: 'sn1',
        patch: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      }],
    })).toThrow(/quadto/)
  })

  it('addNode with id equal to existing shapeNode throws', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'shared',
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'addNode',
        node: { id: 'shared', type: 'n', label: 'N', x: 0, y: 0 },
      }],
    })).toThrow(/shapeNode/)
  })

  it('invert of updateShapeNode closed:false from omitted restores closed', () => {
    const base = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      }],
    })
    expect(base.shapeNodes![0]!.closed).toBeUndefined()
    const forward = {
      ops: [{ op: 'updateShapeNode' as const, id: 'sn1', patch: { closed: false } }],
    }
    const opened = applyPatch(base, forward)
    expect(opened.shapeNodes![0]!.closed).toBe(false)
    const inverse = invertPatch(base, forward)
    const back = applyPatch(opened, { ops: inverse })
    // Omitted ≡ closed for ShapeNode; invert must restore closed truthy.
    expect(back.shapeNodes![0]!.closed).toBeTruthy()
  })

  it('GraphScene load/toJSON preserves shapeNodes', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'slot',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 20 },
          { x: 0, y: 20 },
        ],
        style: { fill: '#e2e8f0' },
      }],
    }))
    expect(scene.toJSON().shapeNodes?.map(s => s.id)).toEqual(['slot'])
    expect(scene.shapeNodes.get('slot')?.style?.fill).toBe('#e2e8f0')
  })

  it('addGroup memberIds may reference shapeNode ids', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      }],
    })
    const next = applyPatch(doc, {
      ops: [{
        op: 'addGroup',
        group: { id: 'g1', label: 'G', memberIds: ['sn1'] },
      }],
    })
    expect(next.groups![0]!.memberIds).toEqual(['sn1'])
  })
})

describe('ShapeNodeView', () => {
  it('hits interior of a filled closed shape and misses outside', () => {
    const shapeNode: GraphShapeNode = {
      id: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
      // omitted closed ≡ closed
      style: { fill: '#e2e8f0', stroke: '#334155' },
    }
    const view = new ShapeNodeView('poly')
    view.sync(shapeNode)
    expect(view.isClosed).toBe(true)
    expect(view.hit(20, 15, 4)).toBe(true)
    expect(view.hit(80, 15, 4)).toBe(false)
  })

  it('hits a point on an open polyline segment and misses off-segment', () => {
    const shapeNode: GraphShapeNode = {
      id: 'open',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      closed: false,
      style: { stroke: '#334155', lineWidth: 2 },
    }
    const view = new ShapeNodeView('open')
    view.sync(shapeNode)
    expect(view.isClosed).toBe(false)
    expect(view.hit(50, 0, 4)).toBe(true)
    expect(view.hit(50, 20, 4)).toBe(false)
    // Open + no fill: interior of a would-be polygon does not hit.
    expect(view.hit(50, 1, 0.5)).toBe(false)
  })

  it('treats explicit closed: true like omitted for interior fill hit', () => {
    const shapeNode: GraphShapeNode = {
      id: 'explicit',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 20, y: 30 },
      ],
      closed: true,
      style: { fill: '#e2e8f0' },
    }
    const view = new ShapeNodeView('explicit')
    view.sync(shapeNode)
    expect(view.hit(20, 10, 4)).toBe(true)
  })

  it('exposes densified points, style cache, labelPosition, and select/hover paint', () => {
    const shapeNode: GraphShapeNode = {
      id: 'styled',
      points: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
      closed: false,
      label: 'Slot',
      style: {
        stroke: '#abc',
        fill: '#def',
        lineWidth: 2,
        alpha: 0.5,
        strokeDash: [4, 2],
        label: { color: '#112233', fontSize: 14, fontWeight: 'bold' },
        select: { color: '#22c55e', width: 4, padding: 1 },
        hover: { color: '#f59e0b', width: 3, padding: 2 },
      },
    }
    const view = new ShapeNodeView('styled')
    view.sync(shapeNode)
    expect(view.points.length).toBeGreaterThanOrEqual(2)
    expect(view.stroke).toBe('#abc')
    expect(view.fill).toBe('#def')
    expect(view.lineWidth).toBe(2)
    expect(view.alpha).toBe(0.5)
    expect(view.strokeDash).toEqual([4, 2])
    expect(view.label).toBe('Slot')
    expect(view.labelPosition).toEqual({ x: 50, y: 12 })
    expect(view.bounds.width).toBeGreaterThan(0)
    expect(view.select?.color).toBe('#22c55e')
    expect(view.hover?.color).toBe('#f59e0b')

    const selected = view.toPaintView(true, false)
    expect(selected.stroke).toBe('#22c55e')
    expect(selected.lineWidth).toBe(6)
    const hovered = view.toPaintView(false, true)
    expect(hovered.stroke).toBe('#f59e0b')
    expect(hovered.lineWidth).toBe(7)
    const idle = view.toPaintView(false, false)
    expect(idle.stroke).toBe('#abc')
    expect(idle.lineWidth).toBe(2)
  })
})

describe('ViewSet shapeNodes', () => {
  it('rebuild / sync create ShapeNodeViews from scene.shapeNodes', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'slot',
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 20, y: 30 },
        ],
        style: { fill: '#e2e8f0' },
      }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    expect(views.getShapeNode('slot')).toBeDefined()
    views.validateDirty(scene)
    expect(views.getShapeNode('slot')!.points.length).toBeGreaterThanOrEqual(2)

    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [
        {
          id: 'slot',
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 20, y: 30 },
          ],
        },
        {
          id: 'slot2',
          points: [{ x: 0, y: 10 }, { x: 50, y: 10 }],
          closed: false,
        },
      ],
    }))
    views.sync(scene)
    views.validateDirty(scene)
    expect(views.getShapeNode('slot2')).toBeDefined()
    expect(views.getShapeNode('slot')!.bounds.width).toBeGreaterThan(0)
  })

  it('auto-fit band unions shape-node members (not boxed nodes only)', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [{
        id: 'band',
        label: 'Shape band',
        memberIds: ['in-group'],
        expanded: true,
        x: 480,
        y: 200,
      }],
      shapeNodes: [{
        id: 'in-group',
        label: 'member',
        groupId: 'band',
        points: [
          { x: 500, y: 240 },
          { x: 580, y: 240 },
          { x: 580, y: 300 },
          { x: 500, y: 300 },
        ],
      }],
    }))
    const band = computeExpandedBandBounds(scene, scene.groups.get('band')!)
    // Must wrap the shape (500–580 × 240–300), not fall back to authored 50×50.
    expect(band.x).toBeLessThanOrEqual(500)
    expect(band.y).toBeLessThanOrEqual(240)
    expect(band.x + band.width).toBeGreaterThanOrEqual(580)
    expect(band.y + band.height).toBeGreaterThanOrEqual(300)
  })
})

function stubRenderer(): Renderer {
  return {
    beginFrame: vi.fn(),
    drawGroup: vi.fn(),
    drawEdge: vi.fn(),
    drawPath: vi.fn(),
    drawShapeNode: vi.fn(),
    drawNode: vi.fn(),
    endFrame: vi.fn(),
    drawSelectionOverlay: vi.fn(),
    drawHoverOverlay: vi.fn(),
    drawMarquee: vi.fn(),
    drawEdgeRubberBand: vi.fn(),
    drawLazyMoveGhost: vi.fn(),
    drawResizeHandle: vi.fn(),
    drawEdgeBendHandle: vi.fn(),
  }
}

async function flushFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

describe('Network GraphShapeNode', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
    document.body.replaceChildren()
  })

  function mountShapeNetwork(): { network: Network; events: GraphEvent[] } {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    network.load({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 40 },
        ],
        style: { stroke: '#334155', fill: '#e2e8f0', lineWidth: 2 },
      }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    const events: GraphEvent[] = []
    network.on(e => { events.push(e) })
    return { network, events }
  }

  it('setSelection accepts a shapeNode id', async () => {
    const { network: net, events } = mountShapeNetwork()
    await flushFrames()
    net.setSelection(['sn1'])
    expect(net.getSelectedIds()).toEqual(['sn1'])
    expect(events.some(e => e.type === 'selectionChanged' && e.selectedIds.includes('sn1'))).toBe(true)
  })

  it('commitShapeNodeCreate returns id and getShapeNodes includes it', async () => {
    const { network: net, events } = mountShapeNetwork()
    await flushFrames()
    const id = net.commitShapeNodeCreate({
      points: [{ x: 10, y: 10 }, { x: 40, y: 40 }, { x: 10, y: 40 }],
      id: 'new-sn',
      style: { shapeKind: 'lineto', fill: '#fff' },
    })
    expect(id).toBe('new-sn')
    expect(net.getShapeNodes().map(s => s.id).sort()).toEqual(['new-sn', 'sn1'])
    expect(events.some(e => e.type === 'shapeNodeCreated' && e.shapeNodeId === 'new-sn')).toBe(true)
  })

  it('commitShapeNodeUpdate / commitShapeNodeRemove emit shapeNode events', async () => {
    const { network: net, events } = mountShapeNetwork()
    await flushFrames()
    net.commitShapeNodeUpdate({
      shapeNodeId: 'sn1',
      patch: {
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 40, y: 50 },
        ],
      },
    })
    expect(net.getShapeNodes().find(s => s.id === 'sn1')!.points).toHaveLength(3)
    expect(events.some(e => e.type === 'shapeNodeUpdated' && e.shapeNodeId === 'sn1')).toBe(true)

    net.commitShapeNodeRemove(['sn1'])
    expect(net.getShapeNodes()).toEqual([])
    expect(events.some(e => e.type === 'shapeNodeRemoved' && e.shapeNodeId === 'sn1')).toBe(true)
  })

  it('paints shapeNode label and selectStyle via drawShapeNode DTO', async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 40 },
        ],
        label: 'Slot',
        style: {
          stroke: '#334155',
          fill: '#e2e8f0',
          lineWidth: 2,
          label: { color: '#111', fontSize: 12 },
          select: { color: '#22c55e', width: 4, glow: false },
        },
      }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)

    const baseCalls = vi.mocked(renderer.drawShapeNode).mock.calls
    expect(baseCalls.length).toBeGreaterThan(0)
    const baseView = baseCalls[baseCalls.length - 1]![1]
    expect(baseView.label?.text).toBe('Slot')
    expect(baseView.label?.color).toBe('#111')
    expect(baseView.selectStyle?.color).toBe('#22c55e')

    vi.mocked(renderer.drawShapeNode).mockClear()
    vi.mocked(renderer.drawResizeHandle).mockClear()
    network.setSelection(['sn1'])
    await flushFrames(3)
    const overlayCalls = vi.mocked(renderer.drawShapeNode).mock.calls
    const selectedView = overlayCalls.find(c => c[1].selected === true)?.[1]
    expect(selectedView).toBeDefined()
    expect(selectedView!.stroke).toBe('#22c55e')
    expect(selectedView!.lineWidth).toBe(4)
    expect(selectedView!.selectStyle?.glow).toBe(false)
    expect(vi.mocked(renderer.drawResizeHandle).mock.calls.length).toBe(3)
  })

  it('hitTestScreen finds a shapeNode on an empty canvas document', async () => {
    const { network: net } = mountShapeNetwork()
    await flushFrames(3)
    // Interior of the triangle near centroid.
    const hit = net.hitTestScreen(50, 15)
    expect(hit).toEqual({ id: 'sn1', kind: 'shapeNode' })
    expect(net.hitTestScreen(200, 200)).toBeUndefined()
  })

  it('hit prefers node over overlapping shapeNode', async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [{
        id: 'n1',
        type: 'u',
        label: 'N',
        x: 40,
        y: 5,
        w: 20,
        h: 20,
      }],
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 40 },
        ],
        style: { fill: '#e2e8f0' },
      }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    expect(network.hitTestScreen(50, 15)).toEqual({ id: 'n1', kind: 'node' })
  })
})

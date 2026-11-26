// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphScene } from '../src/model/index.ts'
import { Network } from '../src/network/network.ts'
import { applyPatch, invertPatch, parseDocument } from '../src/protocol/index.ts'
import type { GraphEvent } from '../src/protocol/events.ts'
import type { GraphPath } from '../src/protocol/types.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { buildPathPolyline } from '../src/ui/path-route.ts'
import { PathView } from '../src/ui/path-view.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('GraphPath protocol', () => {
  it('defaults omitted paths to empty array', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
    })
    expect(doc.paths ?? []).toEqual([])
  })

  it('accepts a lineto open path with two points', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p1',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        style: { stroke: '#334155', lineWidth: 2, shapeKind: 'lineto' },
      }],
    })
    expect(doc.paths).toHaveLength(1)
    expect(doc.paths![0]!.id).toBe('p1')
  })

  it('accepts a closed path', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
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
    expect(doc.paths![0]!.closed).toBe(true)
  })

  it('accepts quadto with odd point count ≥ 3', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'q1',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: -20 },
          { x: 100, y: 0 },
        ],
        style: { shapeKind: 'quadto' },
      }],
    })
    expect(doc.paths![0]!.style?.shapeKind).toBe('quadto')
  })

  it('accepts cubicto with point count ≡ 1 mod 3 and ≥ 4', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
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
    expect(doc.paths![0]!.style?.shapeKind).toBe('cubicto')
  })

  it('rejects path with fewer than two points', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'p1', points: [{ x: 0, y: 0 }] }],
    })).toThrow()
  })

  it('rejects quadto with even point count', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
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
      paths: [{
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

  it('rejects path id that collides with a node id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'same', type: 'n', label: 'N', x: 0, y: 0 }],
      edges: [],
      paths: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects path id that collides with an edge id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [
        { id: 'a', type: 'n', label: 'A', x: 0, y: 0 },
        { id: 'b', type: 'n', label: 'B', x: 10, y: 0 },
      ],
      edges: [{ id: 'same', from: 'a', to: 'b' }],
      paths: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects path id that collides with a group id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      groups: [{ id: 'same', label: 'G', memberIds: [] }],
      paths: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })

  it('rejects duplicate path ids in the same document', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [
        { id: 'dup', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
        { id: 'dup', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] },
      ],
    })).toThrow(/duplicate path id/)
  })

  it('addPath / updatePath / removePath round-trip with invert', () => {
    const empty = parseDocument({ version: 1, nodes: [], edges: [] })
    const added = applyPatch(empty, {
      ops: [{
        op: 'addPath',
        path: { id: 'p1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      }],
    })
    expect(added.paths).toHaveLength(1)
    const updated = applyPatch(added, {
      ops: [{
        op: 'updatePath',
        id: 'p1',
        patch: { points: [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 0 }] },
      }],
    })
    expect(updated.paths![0]!.points).toHaveLength(3)
    const inverse = invertPatch(added, {
      ops: [{
        op: 'updatePath',
        id: 'p1',
        patch: { points: [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 0 }] },
      }],
    })
    const back = applyPatch(updated, { ops: inverse })
    expect(back.paths![0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    const removed = applyPatch(added, { ops: [{ op: 'removePath', id: 'p1' }] })
    expect(removed.paths ?? []).toEqual([])
  })

  it('addPath fails on duplicate id', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'p1', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'addPath',
        path: { id: 'p1', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] },
      }],
    })).toThrow(/duplicate/)
  })

  it('updatePath / removePath fail on missing id', () => {
    const empty = parseDocument({ version: 1, nodes: [], edges: [] })
    expect(() => applyPatch(empty, {
      ops: [{
        op: 'updatePath',
        id: 'missing',
        patch: { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      }],
    })).toThrow(/missing/)
    expect(() => applyPatch(empty, {
      ops: [{ op: 'removePath', id: 'missing' }],
    })).toThrow(/missing/)
  })

  it('updatePath rejects invalid points arity via schema', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'p1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'updatePath',
        id: 'p1',
        patch: { points: [{ x: 0, y: 0 }] },
      }],
    })).toThrow(/points\.length/)
  })

  it('updatePath points that violate existing quadto shapeKind throws', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p1',
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
        op: 'updatePath',
        id: 'p1',
        patch: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      }],
    })).toThrow(/quadto/)
  })

  it('addNode with id equal to existing path throws', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'shared', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    })
    expect(() => applyPatch(doc, {
      ops: [{
        op: 'addNode',
        node: { id: 'shared', type: 'n', label: 'N', x: 0, y: 0 },
      }],
    })).toThrow(/path/)
  })

  it('invert of updatePath closed:true from omitted restores open', () => {
    const base = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'p1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
    })
    expect(base.paths![0]!.closed).toBeUndefined()
    const forward = { ops: [{ op: 'updatePath' as const, id: 'p1', patch: { closed: true } }] }
    const closed = applyPatch(base, forward)
    expect(closed.paths![0]!.closed).toBe(true)
    const inverse = invertPatch(base, forward)
    const back = applyPatch(closed, { ops: inverse })
    expect(back.paths![0]!.closed).toBeFalsy()
  })

  it('GraphScene load/toJSON preserves paths', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'lane',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        closed: false,
        style: { strokeDash: [6, 4] },
      }],
    }))
    expect(scene.toJSON().paths?.map(p => p.id)).toEqual(['lane'])
  })
})

describe('buildPathPolyline', () => {
  it('buildPathPolyline lineto returns control points', () => {
    const pts = buildPathPolyline(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      'lineto',
      false,
    )
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ])
  })

  it('buildPathPolyline closed appends closure', () => {
    const pts = buildPathPolyline(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      'lineto',
      true,
    )
    expect(pts[0]).toEqual(pts[pts.length - 1])
    expect(pts).toHaveLength(4)
  })

  it('buildPathPolyline quadto densifies', () => {
    const controls = [
      { x: 0, y: 0 },
      { x: 50, y: -40 },
      { x: 100, y: 0 },
    ]
    const pts = buildPathPolyline(controls, 'quadto', false)
    expect(pts.length).toBeGreaterThan(controls.length)
  })
})

describe('PathView', () => {
  it('hits a point on a densified segment', () => {
    const path: GraphPath = {
      id: 'seg',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      style: { stroke: '#334155', lineWidth: 2 },
    }
    const view = new PathView('seg')
    view.sync(path)
    expect(view.hit(50, 0, 4)).toBe(true)
    expect(view.hit(50, 20, 4)).toBe(false)
  })

  it('hits inside a closed filled path and misses outside', () => {
    const path: GraphPath = {
      id: 'poly',
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 0, y: 30 },
      ],
      closed: true,
      style: { fill: '#e2e8f0', stroke: '#334155' },
    }
    const view = new PathView('poly')
    view.sync(path)
    expect(view.hit(20, 15, 4)).toBe(true)
    expect(view.hit(80, 15, 4)).toBe(false)
  })

  it('exposes densified points, style cache, and bounds after sync', () => {
    const path: GraphPath = {
      id: 'styled',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      label: 'Lane',
      style: {
        stroke: '#abc',
        fill: '#def',
        lineWidth: 3,
        alpha: 0.5,
        strokeDash: [4, 2],
      },
    }
    const view = new PathView('styled')
    view.sync(path)
    expect(view.points.length).toBeGreaterThanOrEqual(2)
    expect(view.stroke).toBe('#abc')
    expect(view.fill).toBe('#def')
    expect(view.lineWidth).toBe(3)
    expect(view.alpha).toBe(0.5)
    expect(view.strokeDash).toEqual([4, 2])
    expect(view.label).toBe('Lane')
    expect(view.bounds.width).toBeGreaterThan(0)
  })

  it('places label at densified midpoint above the stroke', () => {
    const path: GraphPath = {
      id: 'labeled',
      points: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
      label: 'Plan',
      style: { label: { color: '#112233', fontSize: 14, fontWeight: 'bold' } },
    }
    const view = new PathView('labeled')
    view.sync(path)
    expect(view.labelPosition).toEqual({ x: 50, y: 12 })
    const paint = view.toPaintView(false, false)
    expect(paint.label).toEqual({
      text: 'Plan',
      x: 50,
      y: 12,
      color: '#112233',
      fontSize: 14,
      fontWeight: 'bold',
    })
  })

  it('resolves select / hover chrome into paint stroke color and width', () => {
    const path: GraphPath = {
      id: 'chrome',
      points: [{ x: 0, y: 0 }, { x: 40, y: 0 }],
      style: {
        stroke: '#334155',
        lineWidth: 2,
        select: { color: '#22c55e', width: 4, padding: 1, glow: true, glowBlur: 20 },
        hover: { color: '#f59e0b', width: 3, padding: 2, glow: true },
      },
    }
    const view = new PathView('chrome')
    view.sync(path)
    expect(view.select?.color).toBe('#22c55e')
    expect(view.hover?.color).toBe('#f59e0b')

    const selected = view.toPaintView(true, false)
    expect(selected.stroke).toBe('#22c55e')
    expect(selected.lineWidth).toBe(6) // max(2, 4) + padding*2
    expect(selected.selectStyle).toEqual({
      color: '#22c55e',
      width: 4,
      padding: 1,
      glow: true,
      glowBlur: 20,
    })

    const hovered = view.toPaintView(false, true)
    expect(hovered.stroke).toBe('#f59e0b')
    expect(hovered.lineWidth).toBe(7) // max(2, 3) + padding*2
    expect(hovered.hoverStyle?.glow).toBe(true)

    const idle = view.toPaintView(false, false)
    expect(idle.stroke).toBe('#334155')
    expect(idle.lineWidth).toBe(2)
  })
})

describe('ViewSet paths', () => {
  it('rebuild / sync create PathViews from scene.paths', () => {
    const scene = new GraphScene()
    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'lane', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    }))
    const views = new ViewSet()
    views.rebuild(scene)
    expect(views.getPath('lane')).toBeDefined()
    views.validateDirty(scene)
    expect(views.getPath('lane')!.points.length).toBeGreaterThanOrEqual(2)

    scene.load(parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [
        { id: 'lane', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
        { id: 'lane2', points: [{ x: 0, y: 10 }, { x: 50, y: 10 }] },
      ],
    }))
    views.sync(scene)
    views.validateDirty(scene)
    expect(views.getPath('lane2')).toBeDefined()
    expect(views.getPath('lane')!.bounds.width).toBeGreaterThan(0)
  })
})

function stubRenderer(): Renderer {
  return {
    beginFrame: vi.fn(),
    drawGroup: vi.fn(),
    drawEdge: vi.fn(),
    drawPath: vi.fn(),
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

describe('Network GraphPath', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
    document.body.replaceChildren()
  })

  function mountPathNetwork(): { network: Network; events: GraphEvent[] } {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    network.load({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p1',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        style: { stroke: '#334155', lineWidth: 2 },
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

  it('setSelection accepts a path id', async () => {
    const { network: net, events } = mountPathNetwork()
    await flushFrames()
    net.setSelection(['p1'])
    expect(net.getSelectedIds()).toEqual(['p1'])
    expect(events.some(e => e.type === 'selectionChanged' && e.selectedIds.includes('p1'))).toBe(true)
  })

  it('commitPathCreate returns id and getPaths includes it', async () => {
    const { network: net, events } = mountPathNetwork()
    await flushFrames()
    const id = net.commitPathCreate({
      points: [{ x: 10, y: 10 }, { x: 40, y: 40 }],
      id: 'new-path',
      style: { shapeKind: 'lineto' },
    })
    expect(id).toBe('new-path')
    expect(net.getPaths().map(p => p.id).sort()).toEqual(['new-path', 'p1'])
    expect(events.some(e => e.type === 'pathCreated' && e.pathId === 'new-path')).toBe(true)
  })

  it('commitPathUpdate / commitPathRemove emit path events', async () => {
    const { network: net, events } = mountPathNetwork()
    await flushFrames()
    net.commitPathUpdate({
      pathId: 'p1',
      patch: { points: [{ x: 0, y: 0 }, { x: 80, y: 20 }, { x: 160, y: 0 }] },
    })
    expect(net.getPaths().find(p => p.id === 'p1')!.points).toHaveLength(3)
    expect(events.some(e => e.type === 'pathUpdated' && e.pathId === 'p1')).toBe(true)

    net.commitPathRemove(['p1'])
    expect(net.getPaths()).toEqual([])
    expect(events.some(e => e.type === 'pathRemoved' && e.pathId === 'p1')).toBe(true)
  })

  it('paints path label and selectStyle via drawPath DTO', async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p1',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        label: 'Lane',
        style: {
          stroke: '#334155',
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

    const baseCalls = vi.mocked(renderer.drawPath).mock.calls
    expect(baseCalls.length).toBeGreaterThan(0)
    const baseView = baseCalls[baseCalls.length - 1]![1]
    expect(baseView.label?.text).toBe('Lane')
    expect(baseView.label?.color).toBe('#111')
    expect(baseView.selectStyle?.color).toBe('#22c55e')

    vi.mocked(renderer.drawPath).mockClear()
    network.setSelection(['p1'])
    await flushFrames(3)
    const overlayCalls = vi.mocked(renderer.drawPath).mock.calls
    const selectedView = overlayCalls.find(c => c[1].selected === true)?.[1]
    expect(selectedView).toBeDefined()
    expect(selectedView!.stroke).toBe('#22c55e')
    expect(selectedView!.lineWidth).toBe(4)
    expect(selectedView!.selectStyle?.glow).toBe(false)
  })

  it('hitTestScreen finds a path on an empty canvas document', async () => {
    const { network: net } = mountPathNetwork()
    await flushFrames(3)
    // Camera defaults put world (50,0) near screen (50,0) at zoom 1.
    const hit = net.hitTestScreen(50, 0)
    expect(hit).toEqual({ id: 'p1', kind: 'path' })
    expect(net.hitTestScreen(50, 40)).toBeUndefined()
  })
})

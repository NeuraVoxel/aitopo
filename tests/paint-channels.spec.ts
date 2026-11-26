// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { EdgePaintView, FrameDirty, Renderer } from '../src/render/canvas2d.ts'
import type { GraphEdge } from '../src/protocol/types.ts'

function recordingRenderer(): Renderer & {
  beginDirties: FrameDirty[]
  sceneDraws: number
  edgeBasePaints: number
  reset(): void
} {
  const state = {
    beginDirties: [] as FrameDirty[],
    sceneDraws: 0,
    edgeBasePaints: 0,
    lastDirty: undefined as FrameDirty | undefined,
  }
  const countSceneDraw = (): void => {
    if (state.lastDirty !== 'overlay') state.sceneDraws += 1
  }
  const renderer: Renderer & {
    beginDirties: FrameDirty[]
    sceneDraws: number
    edgeBasePaints: number
    reset(): void
  } = {
    get beginDirties() {
      return state.beginDirties
    },
    get sceneDraws() {
      return state.sceneDraws
    },
    get edgeBasePaints() {
      return state.edgeBasePaints
    },
    reset() {
      state.beginDirties = []
      state.sceneDraws = 0
      state.edgeBasePaints = 0
      state.lastDirty = undefined
    },
    beginFrame: vi.fn((_viewport, dirty: FrameDirty) => {
      state.lastDirty = dirty
      state.beginDirties.push(dirty)
    }),
    drawGroup: vi.fn(countSceneDraw),
    drawEdge: vi.fn((_edge: GraphEdge, view: EdgePaintView) => {
      countSceneDraw()
      if (
        state.lastDirty !== 'overlay'
        && !view.selected
        && !view.hovered
      ) state.edgeBasePaints += 1
    }),
    drawPath: vi.fn(countSceneDraw),
    drawNode: vi.fn(countSceneDraw),
    endFrame: vi.fn(),
    drawSelectionOverlay: vi.fn(),
    drawHoverOverlay: vi.fn(),
    drawMarquee: vi.fn(),
    drawEdgeRubberBand: vi.fn(),
    drawLazyMoveGhost: vi.fn(),
    drawResizeHandle: vi.fn(),
    drawEdgeBendHandle: vi.fn(),
  }
  return renderer
}

async function flushFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

describe('paint channels', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
  })

  it('setSelection scene-paints under-body glow; setHover stays overlay-only', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: 'B', x: 80, y: 0, w: 40, h: 24 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', kind: 'data' }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()
    vi.mocked(renderer.drawNode).mockClear()
    vi.mocked(renderer.drawSelectionOverlay).mockClear()

    network.setSelection(['a'])
    await flushFrames(2)
    expect(renderer.beginDirties.some(d => d !== 'overlay' && d !== 'all')).toBe(true)
    expect(renderer.sceneDraws).toBeGreaterThan(0)
    expect(renderer.drawSelectionOverlay).toHaveBeenCalled()
    const drawnNodeIds = vi.mocked(renderer.drawNode).mock.calls.map(call => call[0].id)
    expect(drawnNodeIds).toContain('a')
    expect(drawnNodeIds).not.toContain('b')

    renderer.reset()
    vi.mocked(renderer.drawSelectionOverlay).mockClear()
    vi.mocked(renderer.drawHoverOverlay).mockClear()
    vi.mocked(renderer.drawNode).mockClear()

    network.setHover('b')
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])
    expect(renderer.sceneDraws).toBe(0)
    expect(renderer.drawHoverOverlay).toHaveBeenCalled()
  })

  it('scene repaints keep hover-related data edges on the root layer', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 0, w: 40, h: 24 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', kind: 'data' }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()

    // Hovering a node highlights related data edges via an overlay-only frame.
    network.setHover('a')
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])

    // Moving the node repaints the scene while it is still hovered; the edge
    // must keep its base paint on the root layer, otherwise unhover (which is
    // overlay-only) exposes a hole where the scene pass skipped the edge.
    renderer.reset()
    network.previewNodePosition('a', 80, 40)
    await flushFrames(2)
    expect(renderer.edgeBasePaints).toBeGreaterThan(0)

    renderer.reset()
    network.setHover(undefined)
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])
  })

  it('requestOverlayPaint does not draw scene bodies', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 }],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()

    const remove = network.addOverlayChrome({
      paint(r) {
        r.drawMarquee({ x: 1, y: 2, width: 3, height: 4 })
      },
    })
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])
    expect(renderer.sceneDraws).toBe(0)
    expect(renderer.drawMarquee).toHaveBeenCalled()
    remove()
  })

  it('updateCamera still schedules a full scene frame', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 }],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()

    network.updateCamera(viewport => {
      viewport.panBy(10, 0)
    })
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['all'])
    expect(renderer.sceneDraws).toBeGreaterThan(0)
  })

  it('previewNodePosition schedules a partial scene dirty rect', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 0, w: 40, h: 24 },
      ],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()

    network.previewNodePosition('a', 80, 40)
    await flushFrames(2)
    expect(renderer.beginDirties).toHaveLength(1)
    const dirty = renderer.beginDirties[0]
    expect(dirty).not.toBe('all')
    expect(dirty).not.toBe('overlay')
    expect(Array.isArray(dirty)).toBe(true)
    expect(renderer.sceneDraws).toBeGreaterThan(0)
  })

  it('group collapse dirties remapped cross-edge geometry outside the band', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    // Expanded band ~[80,80]–[250,180]; external node far right so the cross
    // edge leaves the band. Collapse only patches the group (no memberMoves).
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 100, y: 100, w: 50, h: 50, groupId: 'g1' },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 100, w: 50, h: 50, groupId: 'g1' },
        { id: 'c', type: 'unit', label: 'C', x: 520, y: 110, w: 50, h: 50 },
      ],
      edges: [{ id: 'cross', from: 'a', to: 'c', kind: 'flow' }],
      groups: [{
        id: 'g1',
        label: 'G',
        memberIds: ['a', 'b'],
        expanded: true,
        x: 80,
        y: 80,
      }],
    })
    host = document.createElement('div')
    host.style.width = '700px'
    host.style.height = '400px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()

    network.toggleGroupExpanded('g1')
    await flushFrames(2)

    expect(renderer.beginDirties.length).toBeGreaterThan(0)
    const dirty = renderer.beginDirties[0]
    expect(dirty).not.toBe('overlay')
    // Partial dirty must reach the far endpoint of the pre-collapse cross edge;
    // band-only dirty (~x<280) would leave a stale stroke to C.
    if (dirty === 'all') return
    expect(Array.isArray(dirty)).toBe(true)
    const rects = dirty as { x: number; y: number; width: number; height: number }[]
    let minX = Infinity
    let maxX = -Infinity
    for (const r of rects) {
      minX = Math.min(minX, r.x)
      maxX = Math.max(maxX, r.x + r.width)
    }
    expect(maxX).toBeGreaterThan(450)
  })

  it('preview move of To dirties full From bounds (no strip residual)', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'agent', label: 'From', x: 80, y: 0 },
        { id: 'b', type: 'agent', label: 'To', x: 280, y: 120 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', label: 'link' }],
      groups: [],
    })
    host = document.createElement('div')
    host.style.width = '640px'
    host.style.height = '400px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()
    vi.mocked(renderer.drawNode).mockClear()

    network.setSelection(['b'])
    await flushFrames(2)
    renderer.reset()
    vi.mocked(renderer.drawNode).mockClear()

    network.previewNodePosition('b', 280, 220)
    await flushFrames(2)

    const dirty = renderer.beginDirties[0]
    expect(Array.isArray(dirty)).toBe(true)
    const rects = dirty as { x: number; y: number; width: number; height: number }[]
    const minX = Math.min(...rects.map(r => r.x))
    // Far endpoint must be fully cleared (body starts at x=80), not only the
    // edge-strip clip (~x≥118) that left a From residual in hello demo.
    expect(minX).toBeLessThanOrEqual(80)
    const drawn = vi.mocked(renderer.drawNode).mock.calls.map(call => call[0].id)
    expect(drawn).toContain('b')
    expect(drawn).toContain('a')
  })
})

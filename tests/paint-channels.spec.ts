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
    drawShapeNode: vi.fn(countSceneDraw),
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
        // Far enough that selection glow pad on `a` does not expand into `b`.
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

    // Related-edge hover stroke lives on root (layer order), so node hover
    // that fans out to edges schedules a scene paint — not overlay-only.
    network.setHover('a')
    await flushFrames(2)
    expect(renderer.beginDirties.some(d => d !== 'overlay')).toBe(true)
    expect(
      vi.mocked(renderer.drawEdge).mock.calls.some(c => c[0].id === 'e1' && c[1].hovered),
    ).toBe(true)

    // Moving the node while hovered still paints the edge on the root layer.
    renderer.reset()
    vi.mocked(renderer.drawEdge).mockClear()
    network.previewNodePosition('a', 80, 40)
    await flushFrames(2)
    expect(vi.mocked(renderer.drawEdge).mock.calls.some(c => c[0].id === 'e1')).toBe(true)

    // Clearing hover scene-paints related edges back to the base stroke.
    renderer.reset()
    network.setHover(undefined)
    await flushFrames(2)
    expect(renderer.beginDirties.some(d => d !== 'overlay')).toBe(true)
    expect(renderer.edgeBasePaints).toBeGreaterThan(0)
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

  it('partial dirty expand skips non-finite neighbor bounds without hanging', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
        { id: 'bad', type: 'unit', label: 'Bad', x: 80, y: 0, w: 40, h: 24 },
      ],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    // Bypass schema: corrupt live geometry so padded AABB is NaN.
    network.previewNodePosition('bad', Number.NaN, 0)
    renderer.reset()

    const started = Date.now()
    network.apply({
      ops: [{ op: 'updateNode', id: 'a', patch: { label: 'A2' } }],
    })
    await flushFrames(2)
    expect(Date.now() - started).toBeLessThan(2000)
    expect(renderer.beginDirties.length).toBeGreaterThan(0)
  })

  it('partial dirty expands to full bounds of intersecting neighbors', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 100, h: 40 },
        { id: 'b', type: 'unit', label: 'B', x: 80, y: 0, w: 100, h: 40 },
        { id: 'c', type: 'unit', label: 'C', x: 400, y: 0, w: 40, h: 24 },
      ],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '500px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()
    vi.mocked(renderer.drawNode).mockClear()

    network.apply({
      ops: [{ op: 'updateNode', id: 'a', patch: { label: 'A2' } }],
    })
    await flushFrames(2)

    expect(renderer.beginDirties).toHaveLength(1)
    const dirty = renderer.beginDirties[0]
    expect(Array.isArray(dirty)).toBe(true)
    const rect = (dirty as Exclude<FrameDirty, 'all' | 'overlay'>)[0]!
    // Neighbor b (overlapping) is fully covered; distant c stays outside.
    expect(rect.x).toBeLessThanOrEqual(80)
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(180)
    expect(rect.x + rect.width).toBeLessThan(400)

    const drawn = vi.mocked(renderer.drawNode).mock.calls.map(call => call[0].id)
    expect(drawn).toContain('a')
    expect(drawn).toContain('b')
    expect(drawn).not.toContain('c')
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

  it('previewShapeNodePoints dirties the shape body, not only the group band', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    // Document group at 480,200 (50×50 fallback when empty of boxed nodes).
    // Shape member sits at 500–580 × 240–300 — outside that tiny band.
    network.load({
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
        style: { fill: '#ccfbf1', stroke: '#0f766e', lineWidth: 2 },
      }],
    })
    host = document.createElement('div')
    host.style.width = '700px'
    host.style.height = '400px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    renderer.reset()
    vi.mocked(renderer.drawShapeNode).mockClear()

    network.setSelection(['in-group'])
    await flushFrames(2)
    renderer.reset()
    vi.mocked(renderer.drawShapeNode).mockClear()

    network.previewShapeNodePoints('in-group', [
      { x: 520, y: 260 },
      { x: 600, y: 260 },
      { x: 600, y: 320 },
      { x: 520, y: 320 },
    ])
    await flushFrames(2)

    const dirty = renderer.beginDirties[0]
    expect(dirty).not.toBe('overlay')
    // Full-frame is fine; partial must cover the old filled body (y≥240), not
    // only the authored 50×50 band at y=200 that left a member ghost.
    if (dirty !== 'all') {
      expect(Array.isArray(dirty)).toBe(true)
      const rects = dirty as { x: number; y: number; width: number; height: number }[]
      let maxY = -Infinity
      let minX = Infinity
      for (const r of rects) {
        maxY = Math.max(maxY, r.y + r.height)
        minX = Math.min(minX, r.x)
      }
      expect(maxY).toBeGreaterThan(290)
      expect(minX).toBeLessThanOrEqual(500)
    }
    const drawn = vi.mocked(renderer.drawShapeNode).mock.calls.map(call => call[0].id)
    expect(drawn).toContain('in-group')
  })

  it('setHover with the same id does not schedule another overlay paint', async () => {
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

    network.setHover('a')
    await flushFrames(2)
    renderer.reset()
    vi.mocked(renderer.beginFrame).mockClear()

    network.setHover('a')
    await flushFrames(2)
    expect(renderer.beginFrame).not.toHaveBeenCalled()
  })

  it('viewport-culls nodes outside the camera when painting all', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'near', type: 'unit', label: 'Near', x: 10, y: 10, w: 40, h: 24 },
        { id: 'far', type: 'unit', label: 'Far', x: 4000, y: 4000, w: 40, h: 24 },
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
    vi.mocked(renderer.drawNode).mockClear()

    network.updateCamera(vp => {
      // happy-dom often leaves getBoundingClientRect at 0 — force a real view.
      vp.setViewSize({ width: 400, height: 300 })
      vp.setCamera({ x: 0, y: 0, zoom: 1 })
    })
    await flushFrames(2)
    const drawn = vi.mocked(renderer.drawNode).mock.calls.map(call => call[0].id)
    expect(drawn).toContain('near')
    expect(drawn).not.toContain('far')
  })

  it('shows Zoom and FPS in the top-right view stats HUD', async () => {
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

    const hud = host.querySelector('.aitopo-view-stats')
    expect(hud).toBeTruthy()
    expect(hud?.textContent ?? '').toMatch(/Zoom\s+\d+\.\d{2}/)
    expect(hud?.textContent ?? '').toMatch(/FPS\s+\d+/)

    network.updateCamera(vp => {
      vp.setZoom(2)
    })
    expect(hud?.textContent ?? '').toContain('Zoom 2.00')
  })

  it('hides view stats HUD when viewStatsVisible is false', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      viewStatsVisible: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 }],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '200px'
    host.style.height = '150px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(2)
    expect(host.querySelector('.aitopo-view-stats')).toBeNull()
  })
})

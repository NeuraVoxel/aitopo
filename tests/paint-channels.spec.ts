// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { FrameDirty, Renderer } from '../src/render/canvas2d.ts'

function recordingRenderer(): Renderer & {
  beginDirties: FrameDirty[]
  sceneDraws: number
  reset(): void
} {
  const state = {
    beginDirties: [] as FrameDirty[],
    sceneDraws: 0,
    lastDirty: undefined as FrameDirty | undefined,
  }
  const countSceneDraw = (): void => {
    if (state.lastDirty !== 'overlay') state.sceneDraws += 1
  }
  const renderer: Renderer & {
    beginDirties: FrameDirty[]
    sceneDraws: number
    reset(): void
  } = {
    get beginDirties() {
      return state.beginDirties
    },
    get sceneDraws() {
      return state.sceneDraws
    },
    reset() {
      state.beginDirties = []
      state.sceneDraws = 0
      state.lastDirty = undefined
    },
    beginFrame: vi.fn((_viewport, dirty: FrameDirty) => {
      state.lastDirty = dirty
      state.beginDirties.push(dirty)
    }),
    drawGroup: vi.fn(countSceneDraw),
    drawEdge: vi.fn(countSceneDraw),
    drawNode: vi.fn(countSceneDraw),
    endFrame: vi.fn(),
    drawSelectionOverlay: vi.fn(),
    drawHoverOverlay: vi.fn(),
    drawMarquee: vi.fn(),
    drawEdgeRubberBand: vi.fn(),
    drawLazyMoveGhost: vi.fn(),
    drawDropTargetHighlight: vi.fn(),
    drawResizeHandle: vi.fn(),
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

  it('setSelection and setHover schedule overlay-only frames', async () => {
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

    network.setSelection(['a'])
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])
    expect(renderer.sceneDraws).toBe(0)
    expect(renderer.drawSelectionOverlay).toHaveBeenCalled()

    renderer.reset()
    vi.mocked(renderer.drawSelectionOverlay).mockClear()
    vi.mocked(renderer.drawHoverOverlay).mockClear()

    network.setHover('b')
    await flushFrames(2)
    expect(renderer.beginDirties).toEqual(['overlay'])
    expect(renderer.sceneDraws).toBe(0)
    expect(renderer.drawHoverOverlay).toHaveBeenCalled()
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
})

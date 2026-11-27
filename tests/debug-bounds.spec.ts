// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { DebugElementBounds } from '../src/render/debug-bounds.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { GraphScene } from '../src/model/scene.ts'
import { NodeView } from '../src/ui/node-view.ts'
import { EdgeView } from '../src/ui/edge-view.ts'

function stubRenderer(): Renderer & {
  debugCalls: DebugElementBounds[][]
} {
  const debugCalls: DebugElementBounds[][] = []
  return {
    debugCalls,
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
    setDebugPaintRects: vi.fn(),
    drawDebugElementBounds: vi.fn((elements: readonly DebugElementBounds[]) => {
      debugCalls.push([...elements])
    }),
  }
}

async function flushFrames(count = 3): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

describe('debug bounds', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
  })

  it('NodeView.debugBounds exposes body + attachment OBBs and geometry/paint AABBs', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      edges: [],
      nodes: [{
        id: 'n',
        type: 'unit',
        label: 'Hello',
        label2: 'meta',
        x: 10,
        y: 20,
        w: 80,
        h: 40,
        angle: 30,
        style: { showIcon: false },
      }],
    })
    const view = new NodeView('n')
    view.validate(scene)
    const debug = view.debugBounds()
    expect(debug).toBeDefined()
    expect(debug!.angle).toBe(30)
    expect(debug!.oriented.map(p => p.label)).toEqual(
      expect.arrayContaining(['body', 'Label', 'Label2']),
    )
    expect(debug!.oriented.find(p => p.label === 'body')!.rect).toEqual(view.bodyBounds)
    expect(debug!.aabbs.map(a => a.label)).toEqual(['geometry', 'paint'])
    expect(debug!.aabbs.find(a => a.label === 'geometry')!.rect).toEqual(view.bounds)
    expect(debug!.aabbs.find(a => a.label === 'paint')!.rect).toEqual(view.paintBounds)
  })

  it('EdgeView.debugBounds includes path and label attachments', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: '', x: 0, y: 0, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: '', x: 200, y: 0, w: 40, h: 24 },
      ],
      edges: [{
        id: 'e',
        from: 'a',
        to: 'b',
        kind: 'flow',
        label: 'link',
      }],
    })
    const view = new EdgeView('e')
    view.validate(scene)
    const debug = view.debugBounds()
    expect(debug).toBeDefined()
    expect(debug!.oriented.map(p => p.label)).toEqual(
      expect.arrayContaining(['path', 'EdgeLabel']),
    )
    expect(debug!.aabbs.map(a => a.label)).toEqual(['paint'])
  })

  it('Network calls drawDebugElementBounds when Debug is on', async () => {
    const renderer = stubRenderer()
    host = document.createElement('div')
    document.body.appendChild(host)
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
      debugPaintRects: true,
    })
    network.mount(host)
    network.load({
      version: 1,
      edges: [],
      nodes: [{
        id: 'n',
        type: 'unit',
        label: 'A',
        x: 0,
        y: 0,
        w: 40,
        h: 24,
        style: { showIcon: false },
      }],
    })
    await flushFrames()
    expect(renderer.drawDebugElementBounds).toHaveBeenCalled()
    const last = renderer.debugCalls.at(-1)
    expect(last).toBeDefined()
    expect(last!.some(el => el.id === 'n')).toBe(true)
    const node = last!.find(el => el.id === 'n')!
    expect(node.oriented.some(p => p.label === 'body')).toBe(true)
    expect(node.aabbs.some(a => a.label === 'paint')).toBe(true)
  })

  it('Network skips drawDebugElementBounds when Debug is off', async () => {
    const renderer = stubRenderer()
    host = document.createElement('div')
    document.body.appendChild(host)
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.mount(host)
    network.load({
      version: 1,
      edges: [],
      nodes: [{ id: 'n', type: 'unit', label: '', x: 0, y: 0, w: 40, h: 24 }],
    })
    await flushFrames()
    expect(renderer.drawDebugElementBounds).not.toHaveBeenCalled()
  })
})

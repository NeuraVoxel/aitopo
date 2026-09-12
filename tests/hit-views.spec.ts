// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { Renderer } from '../src/render/canvas2d.ts'

function stubRenderer(): Renderer {
  return {
    beginFrame: vi.fn(),
    drawGroup: vi.fn(),
    drawEdge: vi.fn(),
    drawNode: vi.fn(),
    endFrame: vi.fn(),
    drawSelectionOverlay: vi.fn(),
    drawHoverOverlay: vi.fn(),
    drawMarquee: vi.fn(),
    drawEdgeRubberBand: vi.fn(),
    drawLazyMoveGhost: vi.fn(),
    drawDropTargetHighlight: vi.fn(),
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

describe('Network hit-test via Views', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
  })

  it('hits nodes and edges using validated View geometry', async () => {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 0, w: 40, h: 24 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      groups: [{ id: 'g1', label: 'G', memberIds: ['a'], x: -8, y: -8, w: 80, h: 60, expanded: true }],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)

    expect(network.hitTestScreen(20, 12)?.id).toBe('a')
    expect(network.hitTestGroupScreen(10, 10)).toBe('g1')

    // Midpoint of the horizontal orthogonal route between a and b (y ≈ 12).
    const edgeHit = network.hitTestScreen(120, 12)
    expect(edgeHit).toEqual({ id: 'e1', kind: 'edge' })
  })
})

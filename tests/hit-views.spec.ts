// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { placeAlongPath } from '../src/ui/attachment/path.ts'
import { estimateTextSize } from '../src/ui/attachment/position.ts'

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

  it('hits an intra-group edge above the expanded group band (paint order)', async () => {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    // Both endpoints live inside an expanded band; the edge path crosses the fill.
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 40, y: 40, w: 40, h: 24, groupId: 'band' },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 40, w: 40, h: 24, groupId: 'band' },
      ],
      edges: [{ id: 'inner', from: 'a', to: 'b' }],
      groups: [
        {
          id: 'band',
          label: 'Band',
          memberIds: ['a', 'b'],
          x: 20,
          y: 20,
          w: 240,
          h: 80,
          expanded: true,
        },
      ],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)

    // World (120, 52) → screen at zoom 1 after mount; mid-segment over the band fill.
    const mid = network.hitTestScreen(120, 52)
    expect(mid).toEqual({ id: 'inner', kind: 'edge' })
    // Empty band chrome away from the edge still selects the group.
    expect(network.hitTestScreen(60, 90)?.id).toBe('band')
  })

  it('hits an edge via its label attachment away from the stroke', async () => {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 40, w: 40, h: 24 },
        { id: 'b', type: 'unit', label: 'B', x: 240, y: 40, w: 40, h: 24 },
      ],
      edges: [{
        id: 'named',
        from: 'a',
        to: 'b',
        label: 'HANDOFF',
        style: { labelSide: 'pathLeft', labelAt: 0.5 },
      }],
      groups: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)

    const path = network.getEdgePathBounds('named')
    expect(path).toBeDefined()
    // Rebuild the same label box EdgeLabelAttachment validates (default font 11).
    const size = estimateTextSize('HANDOFF', 11)
    // Horizontal mid-route between node centers (~y 52); pathLeft offsets along left normal.
    const labelBox = placeAlongPath(
      [{ x: 40, y: 52 }, { x: 240, y: 52 }],
      0.5,
      size.width,
      size.height,
      8,
      'pathLeft',
    )
    const labelCenter = {
      x: labelBox.x + labelBox.width / 2,
      y: labelBox.y + labelBox.height / 2,
    }
    // Far enough from the stroke that polyline pad alone would miss.
    expect(Math.abs(labelCenter.y - 52)).toBeGreaterThan(4)
    expect(network.hitTestScreen(labelCenter.x, labelCenter.y)).toEqual({
      id: 'named',
      kind: 'edge',
    })
  })
})

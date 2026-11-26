// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { GraphEvent } from '../src/protocol/events.ts'
import type { Renderer } from '../src/render/canvas2d.ts'

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

function pointer(type: string, init: {
  clientX: number
  clientY: number
  button?: number
  shiftKey?: boolean
  altKey?: boolean
}): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    buttons: 1,
    clientX: init.clientX,
    clientY: init.clientY,
    shiftKey: init.shiftKey === true,
    altKey: init.altKey === true,
  })
}

function mountNetwork(): {
  network: Network
  events: GraphEvent[]
  hitCanvas: HTMLCanvasElement
  host: HTMLDivElement
} {
  const network = new Network({
    defaultInteractions: false,
    createRenderer: () => stubRenderer(),
  })
  network.load({
    version: 1,
    nodes: [
      { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
      { id: 'b', type: 'unit', label: 'B', x: 200, y: 0, w: 40, h: 24 },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b', waypoints: [{ x: 100, y: 0 }, { x: 100, y: 40 }] }],
    groups: [],
  })
  const host = document.createElement('div')
  host.style.width = '400px'
  host.style.height = '300px'
  document.body.appendChild(host)
  network.mount(host)
  const hitCanvas = network.getHitElement()
  if (hitCanvas === null) throw new Error('missing hit canvas')
  // World (20,12) ≈ node a center at zoom 1 with camera 0,0.
  Object.defineProperty(hitCanvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
  })
  const events: GraphEvent[] = []
  network.on(e => { events.push(e) })
  return { network, events, hitCanvas, host }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('Network.setEditing', () => {
  it('basic mode (Edit off) moves nodes on drag', async () => {
    const { network, events, hitCanvas } = mountNetwork()
    network.setEditing(false)
    expect(network.editing).toBe(false)
    await flushFrames()

    network.setSelection(['a'])
    hitCanvas.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 12 }))
    hitCanvas.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 40 }))
    hitCanvas.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 40 }))
    await flushFrames()

    expect(events.some(e => e.type === 'nodeMoved')).toBe(true)
    expect(network.getNode('a')?.x).not.toBe(0)
  })

  it('edit mode still moves nodes on drag', async () => {
    const { network, events, hitCanvas } = mountNetwork()
    network.setEditing(true)
    expect(network.editing).toBe(true)
    await flushFrames()

    network.setSelection(['a'])
    hitCanvas.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 12 }))
    hitCanvas.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 40 }))
    hitCanvas.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 40 }))
    await flushFrames()

    expect(events.some(e => e.type === 'nodeMoved')).toBe(true)
    expect(network.getNode('a')?.x).not.toBe(0)
  })

  it('toRootJSON returns the full document after edits', () => {
    const { network } = mountNetwork()
    network.setEditing(true)
    network.apply({
      ops: [{ op: 'updateNode', id: 'a', patch: { x: 12, y: 8 } }],
    })
    const root = network.toRootJSON()
    expect(root.nodes.find(n => n.id === 'a')?.x).toBe(12)
    expect(root.edges.some(e => e.id === 'e1')).toBe(true)
  })
})

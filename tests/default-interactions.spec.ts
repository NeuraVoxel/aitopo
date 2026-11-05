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

type PointerInit = {
  clientX: number
  clientY: number
  button?: number
  shiftKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

function pointer(type: string, init: PointerInit): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    buttons: 1,
    clientX: init.clientX,
    clientY: init.clientY,
    shiftKey: init.shiftKey === true,
    ctrlKey: init.ctrlKey === true,
    altKey: init.altKey === true,
    metaKey: false,
  })
  return event
}

function createNetwork(defaultInteractions: boolean): {
  network: Network
  events: GraphEvent[]
  hitCanvas: HTMLCanvasElement
} {
  const network = new Network({
    defaultInteractions,
    createRenderer: () => stubRenderer(),
  })
  network.load({
    version: 1,
    nodes: [
      { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 40, h: 24 },
      { id: 'b', type: 'unit', label: 'B', x: 200, y: 0, w: 40, h: 24 },
    ],
    edges: [],
    groups: [],
  })
  const host = document.createElement('div')
  host.style.width = '400px'
  host.style.height = '300px'
  document.body.appendChild(host)
  network.mount(host)
  const hitCanvas = network.getHitElement()
  if (hitCanvas === null) throw new Error('hit canvas missing after mount')
  return { network, events: [], hitCanvas }
}

describe('Network default interactions', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    document.body.innerHTML = ''
  })

  it('moves a node by drag when defaults are attached', async () => {
    const { network, events } = createNetwork(true)
    cleanup = () => network.destroy()
    network.on(event => events.push(event))
    await flushFrames(2)

    const canvas = network.getHitElement()!
    canvas.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 12 }))
    canvas.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 32 }))
    canvas.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 32 }))

    expect(network.getNode('a')).toMatchObject({ x: 40, y: 20 })
    expect(events.filter(e => e.type === 'nodeMoved')).toEqual([{
      type: 'nodeMoved',
      nodeId: 'a',
      from: { x: 0, y: 0 },
      to: { x: 40, y: 20 },
    }])
  })

  it('marquee-selects nodes covered by the band', async () => {
    const { network, events } = createNetwork(true)
    cleanup = () => network.destroy()
    network.on(event => events.push(event))
    await flushFrames(2)

    const canvas = network.getHitElement()!
    canvas.dispatchEvent(pointer('pointerdown', { clientX: -10, clientY: -10, shiftKey: true }))
    canvas.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 30, shiftKey: true }))
    canvas.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 30, shiftKey: true }))

    // Shift+empty no longer clears on pointerdown (marquee owns replace at up).
    expect(events.filter(e => e.type === 'selectionChanged')).toEqual([
      { type: 'selectionChanged', selectedIds: ['a', 'b'] },
    ])
  })

  it('attaches no default interactions when defaultInteractions is false', async () => {
    const { network, events } = createNetwork(false)
    cleanup = () => network.destroy()
    network.on(event => events.push(event))
    await flushFrames(2)

    const canvas = network.getHitElement()!
    canvas.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 12 }))
    canvas.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 32 }))
    canvas.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 32 }))
    canvas.dispatchEvent(pointer('pointerdown', { clientX: -10, clientY: -10, shiftKey: true }))
    canvas.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 30, shiftKey: true }))
    canvas.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 30, shiftKey: true }))

    expect(network.getNode('a')).toMatchObject({ x: 0, y: 0 })
    expect(events.filter(e => e.type === 'nodeMoved')).toEqual([])
    expect(events.filter(e => e.type === 'selectionChanged')).toEqual([])
  })
})

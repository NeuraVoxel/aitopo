// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'
import type { GraphDocument } from '../src/protocol/types.ts'
import { getSample } from '../demo/samples/registry.ts'

function stubRenderer() {
  return {
    mount: vi.fn(),
    unmount: vi.fn(),
    beginFrame: vi.fn(),
    endFrame: vi.fn(),
    drawNode: vi.fn(),
    drawEdge: vi.fn(),
    drawGroup: vi.fn(),
    drawPath: vi.fn(),
    drawShapeNode: vi.fn(),
    drawSelection: vi.fn(),
    drawHover: vi.fn(),
    drawResizeHandle: vi.fn(),
    drawMarquee: vi.fn(),
    drawRubberBand: vi.fn(),
    clearOverlay: vi.fn(),
    paintOverlayAttachments: vi.fn(),
  }
}

async function flushFrames(n = 2): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}

const layeredDoc: GraphDocument = {
  version: 1,
  layers: [
    { id: 'ground', movable: false },
    { id: 'lanes' },
    { id: 'agents' },
    { id: 'hidden', visible: false },
  ],
  nodes: [
    {
      id: 'car',
      type: 'unit',
      label: 'Car',
      x: 70,
      y: 10,
      w: 40,
      h: 30,
      layerId: 'agents',
    },
    {
      id: 'ghost',
      type: 'unit',
      label: 'Ghost',
      x: 200,
      y: 10,
      w: 40,
      h: 30,
      layerId: 'hidden',
    },
  ],
  edges: [],
  paths: [{
    id: 'cl',
    layerId: 'lanes',
    points: [
      { x: 50, y: 0 },
      { x: 50, y: 40 },
    ],
    style: { stroke: '#111', lineWidth: 4 },
  }],
  shapeNodes: [{
    id: 'surf',
    layerId: 'ground',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 0, y: 40 },
    ],
    style: { fill: '#e2e8f0', stroke: '#334155' },
  }],
}

describe('graph layers', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    if (network !== undefined) {
      network.destroy()
      network = undefined
    }
    if (host !== undefined) {
      host.remove()
      host = undefined
    }
  })

  it('parse fails loud on unknown layerId', () => {
    expect(() => parseDocument({
      version: 1,
      layers: [{ id: 'ground' }],
      nodes: [{
        id: 'n1',
        type: 'unit',
        label: 'N',
        layerId: 'missing',
      }],
      edges: [],
    })).toThrow(/unknown layer/)
  })

  it('parse fails loud on duplicate layer ids', () => {
    expect(() => parseDocument({
      version: 1,
      layers: [{ id: 'a' }, { id: 'a' }],
      nodes: [],
      edges: [],
    })).toThrow(/duplicate id/)
  })

  it('hit prefers upper layer over lower filled surface', async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load(layeredDoc)
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    // Path over ground fill (car sits to the right of the centerline).
    expect(network.hitTestScreen(50, 20)).toEqual({ id: 'cl', kind: 'path' })
    expect(network.hitTestScreen(90, 20)).toEqual({ id: 'car', kind: 'node' })
  })

  it('hidden layer is not hittable', async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load({
      version: 1,
      layers: [{ id: 'hidden', visible: false }],
      nodes: [{
        id: 'ghost',
        type: 'unit',
        label: 'Ghost',
        x: 10,
        y: 10,
        w: 40,
        h: 30,
        layerId: 'hidden',
      }],
      edges: [],
    })
    host = document.createElement('div')
    host.style.width = '400px'
    host.style.height = '300px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)
    expect(network.hitTestScreen(30, 25)).toBeUndefined()
  })

  it('isLayerMovable / isLayerEditable respect layer flags', () => {
    network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      layers: [
        { id: 'locked', movable: false, editable: false },
        { id: 'free' },
      ],
      nodes: [
        {
          id: 'a',
          type: 'unit',
          label: 'A',
          x: 0,
          y: 0,
          layerId: 'locked',
        },
        {
          id: 'b',
          type: 'unit',
          label: 'B',
          x: 40,
          y: 0,
          layerId: 'free',
        },
      ],
      edges: [],
    })
    expect(network.isLayerMovable('a')).toBe(false)
    expect(network.isLayerEditable('a')).toBe(false)
    expect(network.isLayerMovable('b')).toBe(true)
    expect(network.isLayerEditable('b')).toBe(true)
  })

  it('updateNode can clear layerId back to default', () => {
    const doc = parseDocument({
      version: 1,
      layers: [{ id: 'ground' }],
      nodes: [{
        id: 'n1',
        type: 'unit',
        label: 'N',
        layerId: 'ground',
      }],
      edges: [],
    })
    const next = applyPatch(doc, {
      ops: [{ op: 'updateNode', id: 'n1', patch: { layerId: null } }],
    })
    expect(next.nodes[0]?.layerId).toBeUndefined()
  })

  it('elements layer sample parses with ground / lanes / agents', () => {
    const doc = parseDocument(getSample('layer')!.document)
    expect(doc.layers?.map(l => l.id)).toEqual([
      'ground',
      'lanes',
      'agents',
      'hidden',
    ])
    expect(doc.shapeNodes?.[0]?.layerId).toBe('ground')
    expect(doc.paths?.[0]?.layerId).toBe('lanes')
    expect(doc.nodes.find(n => n.id === 'car')?.layerId).toBe('agents')
  })
})

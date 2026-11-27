// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import { parseDocument } from '../src/index.ts'
import { PatchHistory } from '../src/protocol/patch-history.ts'
import type { GraphPatch } from '../src/protocol/patch.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { PERF_CELL_COUNT, buildPerfGridDocument } from '../demo/samples/elements/perf-grid.ts'

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

describe('Perf grid select-all drag does not hang', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    host?.remove()
    network = undefined
    host = undefined
  })

  it(`batch-previews all ${PERF_CELL_COUNT} cells under a time budget`, async () => {
    const renderer = stubRenderer()
    network = new Network({
      defaultInteractions: false,
      expandPartialDirty: false,
      createRenderer: () => renderer,
    })
    const doc = parseDocument(buildPerfGridDocument())
    network.load(doc)
    host = document.createElement('div')
    host.style.width = '900px'
    host.style.height = '700px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(2)

    const cellIds = doc.nodes.map(n => n.id)
    expect(cellIds.length).toBe(PERF_CELL_COUNT)
    network.setSelection(cellIds)
    await flushFrames(1)

    const origins = new Map(
      cellIds.map(id => {
        const node = network!.getNode(id)!
        return [id, { x: node.x ?? 0, y: node.y ?? 0 }] as const
      }),
    )
    const started = Date.now()
    for (let step = 1; step <= 8; step += 1) {
      const updates = cellIds.map(id => {
        const origin = origins.get(id)!
        return { id, x: origin.x + step * 2, y: origin.y + step }
      })
      network.previewNodePositions(updates)
      await flushFrames(1)
    }
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(15_000)

    const commitStarted = Date.now()
    network.commitNodeMoves(
      cellIds.map(id => {
        const origin = origins.get(id)!
        return {
          nodeId: id,
          from: origin,
          to: { x: origin.x + 20, y: origin.y + 10 },
        }
      }),
    )
    await flushFrames(2)
    expect(Date.now() - commitStarted).toBeLessThan(5_000)
  }, 30_000)

  it(`history-wrapped commit of all ${PERF_CELL_COUNT} cells stays under a time budget`, () => {
    network = new Network({
      defaultInteractions: false,
      expandPartialDirty: false,
    })
    const doc = parseDocument(buildPerfGridDocument())
    network.load(doc)
    const rawApply = network.apply.bind(network)
    const history = new PatchHistory(rawApply, () => network!.toJSON())
    network.apply = (patch: GraphPatch | unknown) => {
      history.pushAndApply(patch as GraphPatch)
    }

    const cellIds = doc.nodes.map(n => n.id)
    const started = Date.now()
    network.commitNodeMoves(
      cellIds.map(id => {
        const node = network!.getNode(id)!
        const from = { x: node.x ?? 0, y: node.y ?? 0 }
        return { nodeId: id, from, to: { x: from.x + 8, y: from.y + 4 } }
      }),
    )
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(history.undo()).toBe(true)
    expect(network.getNode(cellIds[0]!)?.x).toBe(doc.nodes.find(n => n.id === cellIds[0])?.x)
  }, 30_000)
})

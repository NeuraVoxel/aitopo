// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import { parseDocument } from '../src/index.ts'
import type { FrameDirty, Renderer } from '../src/render/canvas2d.ts'
import { buildAdasEgoDocument } from '../demo/samples/adas/ego.ts'
import { registerDemoVectorImages } from '../demo/lib/vector-images.ts'
import { getVectorImage, vectorImagePaintCtx } from '../src/ui/vector-image-registry.ts'
import { rotatedAabbOfRectAbout, anglePivot } from '../src/geom.ts'

registerDemoVectorImages()

function recordingRenderer(): Renderer & { beginDirties: FrameDirty[] } {
  const state = { beginDirties: [] as FrameDirty[] }
  return {
    get beginDirties() {
      return state.beginDirties
    },
    beginFrame: vi.fn((_v, dirty: FrameDirty) => {
      state.beginDirties.push(dirty)
    }),
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

function assertFiniteRect(label: string, rect: { x: number; y: number; width: number; height: number }): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Number.isFinite(rect[key]), `${label}.${key}=${rect[key]}`).toBe(true)
  }
}

describe('ADAS ego drag does not hang', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    host?.remove()
    network = undefined
    host = undefined
  })

  it('vectorImage bounds stay finite for ego styles', () => {
    for (const node of buildAdasEgoDocument().nodes) {
      if (node.vectorImage === undefined) continue
      const body = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.w ?? 40,
        height: node.h ?? 80,
      }
      const def = getVectorImage(node.vectorImage)
      expect(def).toBeDefined()
      if (def?.bounds === undefined) continue
      const local = def.bounds(body, vectorImagePaintCtx(node as never))
      assertFiniteRect(`${node.id} local`, local)
      const rot = rotatedAabbOfRectAbout(
        local,
        anglePivot(body, node.angleAnchor),
        node.angle ?? 0,
      )
      assertFiniteRect(`${node.id} rotated`, rot)
    }
  })

  it('preview-drags axle-frame and angled egos under phase pulse', async () => {
    const renderer = recordingRenderer()
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => renderer,
    })
    network.load(parseDocument(buildAdasEgoDocument()))
    host = document.createElement('div')
    host.style.width = '900px'
    host.style.height = '700px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames(3)

    const started = Date.now()
    for (let i = 0; i < 50; i += 1) {
      network.apply({
        ops: [{
          op: 'updateNode',
          id: 'ego-animate',
          patch: {
            data: {
              fill: '#bfdbfe',
              stroke: '#1d4ed8',
              role: 'ego',
              axle: 'rear',
              speedMs: 12.5,
              vectorImagePhase: (i / 50) % 1,
            },
          },
        }],
      })
      network.previewNodePosition('ego-axle-frame', 90 + i * 4, 400 + (i % 7))
      network.previewNodePosition('ego-angle', 230 + i * 2, 160 + (i % 3))
      network.previewNodePosition('ego-length', 370 - i, 180)
      await flushFrames(1)
      expect(Date.now() - started).toBeLessThan(10_000)
    }

    const partial = renderer.beginDirties.filter(d => Array.isArray(d)) as { x: number; y: number; width: number; height: number }[][]
    for (const batch of partial) {
      for (const rect of batch) assertFiniteRect('dirty', rect)
    }
  }, 15_000)
})

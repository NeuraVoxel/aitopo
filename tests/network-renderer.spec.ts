import { describe, expect, it, vi } from 'vitest'
import { resolveRenderer, type NetworkOptions } from '../src/network/network.ts'
import type { Renderer } from '../src/render/canvas2d.ts'

function fakeCanvases(): {
  root: HTMLCanvasElement
  overlay: HTMLCanvasElement
  debugPaintRects: boolean
} {
  return {
    root: { tagName: 'CANVAS' } as HTMLCanvasElement,
    overlay: { tagName: 'CANVAS' } as HTMLCanvasElement,
    debugPaintRects: false,
  }
}

describe('resolveRenderer', () => {
  it('uses createRenderer when provided', () => {
    const fake: Renderer = {
      beginFrame: vi.fn(),
      drawGroup: vi.fn(),
      drawEdge: vi.fn(),
      drawNode: vi.fn(),
      endFrame: vi.fn(),
      drawSelectionOverlay: vi.fn(),
      drawMarquee: vi.fn(),
      drawEdgeRubberBand: vi.fn(),
    }
    const createRenderer = vi.fn((_canvases: {
      root: HTMLCanvasElement
      overlay: HTMLCanvasElement
      debugPaintRects: boolean
    }) => fake)
    const options: NetworkOptions = { createRenderer }
    const canvases = fakeCanvases()
    const resolved = resolveRenderer(options, canvases)
    expect(createRenderer).toHaveBeenCalledWith(canvases)
    expect(resolved).toBe(fake)
  })
})

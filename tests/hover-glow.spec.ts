// @vitest-environment happy-dom

/**
 * Selection under-body glow + hover ring (twaver outer.style glow on select).
 */

import { describe, expect, it, vi } from 'vitest'
import { Canvas2DRenderer } from '../src/render/canvas2d.ts'
import type { NodePaintView } from '../src/render/canvas2d.ts'
import { parseDocument } from '../src/protocol/parse.ts'
import type { GraphNode } from '../src/protocol/types.ts'

function mockContext(): CanvasRenderingContext2D & { blurAtFill: number } {
  const ctx = {
    blurAtFill: 0,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(function (this: { shadowBlur: number; blurAtFill: number }) {
      this.blurAtFill = this.shadowBlur
    }),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
  }
  return ctx as unknown as CanvasRenderingContext2D & { blurAtFill: number }
}

function rendererWithMockCanvases(): {
  renderer: Canvas2DRenderer
  rootCtx: ReturnType<typeof mockContext>
  overlayCtx: ReturnType<typeof mockContext>
} {
  const root = document.createElement('canvas')
  const overlay = document.createElement('canvas')
  const rootCtx = mockContext()
  const overlayCtx = mockContext()
  Object.defineProperty(root, 'getContext', { value: () => rootCtx })
  Object.defineProperty(overlay, 'getContext', { value: () => overlayCtx })
  return { renderer: new Canvas2DRenderer({ root, overlay }), rootCtx, overlayCtx }
}

const sampleNode: GraphNode = {
  id: 'n',
  type: 'agent',
  label: 'N',
  x: 10,
  y: 20,
  w: 40,
  h: 30,
}

function bodyView(overrides: Partial<NodePaintView> = {}): NodePaintView {
  return {
    bounds: { x: 10, y: 20, width: 40, height: 30 },
    bodyBounds: { x: 10, y: 20, width: 40, height: 30 },
    unionBounds: { x: 10, y: 20, width: 40, height: 30 },
    selected: false,
    hovered: false,
    circular: false,
    alpha: 1,
    attachments: [],
    overlayAttachments: [],
    ...overrides,
  }
}

describe('selection / hover glow', () => {
  it('parses select.glow and glowBlur on nodes', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{
        id: 'n',
        type: 'agent',
        label: 'N',
        x: 0,
        y: 0,
        style: { select: { glow: true, glowBlur: 20, color: '#22c55e' } },
      }],
      edges: [],
    })
    expect(doc.nodes[0]!.style?.select?.glow).toBe(true)
    expect(doc.nodes[0]!.style?.select?.glowBlur).toBe(20)
  })

  it('applies shadowBlur under body fill for default selection', () => {
    const { renderer, rootCtx, overlayCtx } = rendererWithMockCanvases()
    renderer.drawNode(sampleNode, bodyView({ selected: true }))
    expect(rootCtx.fill).toHaveBeenCalled()
    expect(rootCtx.blurAtFill).toBe(16)
    renderer.drawSelectionOverlay(
      { x: 10, y: 20, width: 40, height: 30 },
      undefined,
      1,
    )
    expect(overlayCtx.fill).not.toHaveBeenCalled()
    expect(overlayCtx.stroke).toHaveBeenCalled()
  })

  it('honors select.glowBlur on body fill', () => {
    const { renderer, rootCtx } = rendererWithMockCanvases()
    renderer.drawNode(
      sampleNode,
      bodyView({
        selected: true,
        selectStyle: { glowBlur: 24, color: '#3b82f6' },
      }),
    )
    expect(rootCtx.blurAtFill).toBe(24)
  })

  it('skips selection glow when select.glow is false', () => {
    const { renderer, rootCtx } = rendererWithMockCanvases()
    renderer.drawNode(
      sampleNode,
      bodyView({
        selected: true,
        selectStyle: { glow: false, color: '#3b82f6' },
      }),
    )
    expect(rootCtx.blurAtFill).toBe(0)
  })

  it('keeps hover as dashed ring without glow by default', () => {
    const { renderer, overlayCtx } = rendererWithMockCanvases()
    renderer.drawHoverOverlay(
      { x: 10, y: 20, width: 40, height: 30 },
      undefined,
      1,
    )
    expect(overlayCtx.fill).not.toHaveBeenCalled()
    expect(overlayCtx.stroke).toHaveBeenCalled()
    expect(overlayCtx.setLineDash).toHaveBeenCalled()
  })

  it('allows opt-in hover glow via hover.glow true', () => {
    const { renderer, overlayCtx } = rendererWithMockCanvases()
    renderer.drawHoverOverlay(
      { x: 0, y: 0, width: 50, height: 40 },
      { glow: true, glowBlur: 18 },
      1,
    )
    expect(overlayCtx.fill).toHaveBeenCalled()
    expect(overlayCtx.blurAtFill).toBe(18)
  })
})

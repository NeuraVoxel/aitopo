// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'
import type { Renderer } from '../src/render/canvas2d.ts'
import { GraphScene } from '../src/model/scene.ts'
import { NodeView } from '../src/ui/node-view.ts'
import { PathView } from '../src/ui/path-view.ts'

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

async function flushFrames(count = 3): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

describe('element angle views', () => {
  let network: Network | undefined
  let host: HTMLDivElement | undefined

  afterEach(() => {
    network?.destroy()
    network = undefined
    host?.remove()
    host = undefined
  })

  it('keeps node body original while bounds become the rotated AABB', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      edges: [],
      nodes: [{
        id: 'n',
        type: 'unit',
        label: '',
        x: 100,
        y: 100,
        w: 100,
        h: 20,
        angle: 90,
        style: { showIcon: false },
      }],
    })
    const view = new NodeView('n')
    view.validate(scene)
    expect(view.bodyBounds).toEqual({ x: 100, y: 100, width: 100, height: 20 })
    expect(view.bounds.x).toBeCloseTo(140)
    expect(view.bounds.y).toBeCloseTo(60)
    expect(view.bounds.width).toBeCloseTo(20)
    expect(view.bounds.height).toBeCloseTo(100)
    const paint = view.toPaintView(false, false)
    expect(paint.angle).toBe(90)
    expect(paint.bodyBounds).toEqual(view.bodyBounds)
  })

  it('omits angle fields on the paint DTO when angle is 0', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      edges: [],
      nodes: [{ id: 'n', type: 'unit', label: '', x: 0, y: 0, w: 40, h: 20 }],
    })
    const view = new NodeView('n')
    view.validate(scene)
    const paint = view.toPaintView(false, false)
    expect('angle' in paint).toBe(false)
    expect('angleAnchor' in paint).toBe(false)
  })

  it('honors angleAnchor for path pivot without rewriting points', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        angle: 90,
        angleAnchor: { u: 0, v: 0 },
      }],
    })
    const view = new PathView('p')
    view.validate(scene.paths.get('p'))
    expect(view.pivot).toEqual({ x: 0, y: 0 })
    expect(view.points[1]).toEqual({ x: 100, y: 0 })
    expect(view.hit(0, 80, 2)).toBe(true)
    expect(view.hit(80, 0, 2)).toBe(false)
    expect(view.toPaintView(false, false).anglePivot).toEqual({ x: 0, y: 0 })
  })

  it('hit-tests rotated nodes, groups, and paths in their own frame', async () => {
    network = new Network({
      defaultInteractions: false,
      createRenderer: () => stubRenderer(),
    })
    network.load({
      version: 1,
      edges: [],
      nodes: [{
        id: 'n',
        type: 'unit',
        label: '',
        x: 100,
        y: 100,
        w: 100,
        h: 20,
        angle: 90,
        style: { showIcon: false },
      }],
      groups: [{
        id: 'g',
        label: '',
        memberIds: [],
        x: 400,
        y: 100,
        w: 100,
        h: 20,
        angle: 90,
        expanded: false,
        style: { showIcon: false },
      }],
      paths: [{
        id: 'p',
        points: [{ x: 0, y: 300 }, { x: 100, y: 300 }],
        angle: 90,
      }],
    })
    host = document.createElement('div')
    host.style.width = '600px'
    host.style.height = '400px'
    document.body.appendChild(host)
    network.mount(host)
    await flushFrames()

    // Node: rotated column x∈[140,160], y∈[60,160]; original row corners are outside it.
    expect(network.hitTestScreen(150, 70)?.id).toBe('n')
    expect(network.hitTestScreen(105, 110)).toBeUndefined()

    // Group (collapsed band): same shape at x≈450.
    expect(network.hitTestScreen(450, 70)).toEqual({ id: 'g', kind: 'group' })
    expect(network.hitTestScreen(405, 110)).toBeUndefined()

    // Path: horizontal authored line becomes vertical about its AABB center (50, 300).
    expect(network.hitTestScreen(50, 260)).toEqual({ id: 'p', kind: 'path' })
    expect(network.hitTestScreen(10, 300)).toBeUndefined()
  })
})

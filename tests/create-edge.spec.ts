import { describe, expect, it, vi } from 'vitest'
import { CreateEdgeInteraction } from '../src/interaction/create-edge.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphGroup, GraphNode } from '../src/protocol/types.ts'

class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()
  pointerCaptureIds = new Set<number>()

  addEventListener(type: string, listener: (event: PointerEvent) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: PointerEvent) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    }
  }

  setPointerCapture(pointerId: number): void {
    this.pointerCaptureIds.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.pointerCaptureIds.delete(pointerId)
  }

  dispatch(
    type: string,
    partial: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'> & {
      pointerId?: number
      altKey?: boolean
    },
  ): void {
    const event = {
      pointerId: 1,
      altKey: false,
      ...partial,
    } as PointerEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function node(partial: Partial<GraphNode> & Pick<GraphNode, 'id'>): GraphNode {
  return {
    type: 'u',
    label: partial.id,
    x: 0,
    y: 0,
    w: 40,
    h: 40,
    ...partial,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  groups?: GraphGroup[]
  hitAt: (x: number, y: number) => {
    id: string
    kind: 'node' | 'shapeNode' | 'edge' | 'group' | 'path'
  } | undefined
}): InteractionHost & {
  commitEdgeCreate: ReturnType<typeof vi.fn>
  addOverlayChrome: ReturnType<typeof vi.fn>
  rubberBandClears: number
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  const groups = new Map((options.groups ?? []).map(g => [g.id, g]))
  const commitEdgeCreate = vi.fn(() => 'e-new')
  let gestureDragged = false
  let rubberBandClears = 0
  const chromeList: Array<import('../src/interaction/types.ts').OverlayChrome> = []
  let bandPaintCount = 0

  const paintChrome = (): void => {
    const renderer = {
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
      drawEdgeRubberBand: vi.fn(() => {
        bandPaintCount += 1
      }),
      drawLazyMoveGhost: vi.fn(),
      drawResizeHandle: vi.fn(),
      drawEdgeBendHandle: vi.fn(),
    }
    for (const chrome of chromeList) chrome.paint(renderer)
  }

  const addOverlayChrome = vi.fn((chrome: import('../src/interaction/types.ts').OverlayChrome) => {
    chromeList.push(chrome)
    paintChrome()
    return () => {
      const index = chromeList.indexOf(chrome)
      if (index >= 0) chromeList.splice(index, 1)
      rubberBandClears += 1
      paintChrome()
    }
  })

  return {
    get rubberBandClears() {
      return rubberBandClears
    },
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: (x, y) => options.hitAt(x, y),
    setSelection: vi.fn(),
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.get(id),
    getGroup: id => groups.get(id),
    getNodes: () => [...nodes.values()],
    getEdges: () => [],
    getPaths: () => [],
    getShapeNodes: () => [],
    getElementLayer: () => ({ id: 'default' }),
    isLayerMovable: () => true,
    isLayerEditable: () => true,
    getGroups: () => [...groups.values()],
    getGroupBandBounds: id => (groups.has(id) ? { x: 0, y: 0, width: 100, height: 80 } : undefined),
    getEdgePathBounds: () => undefined,
    getPathBounds: () => undefined,
    getShapeNodeBounds: () => undefined,
    getSelectedIds: () => [],
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    previewNodeBounds: vi.fn(),
    previewGroupMove: vi.fn(),
    commitGroupMove: vi.fn(),
    toggleGroupExpanded: vi.fn(),
    commitNodeMove: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate,
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints: vi.fn(),
    previewPathPoints: vi.fn(),
    previewShapeNodePoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate: vi.fn(),
    commitPathUpdate: vi.fn(),
    commitPathRemove: vi.fn(),
    commitShapeNodeCreate: vi.fn(),
    commitShapeNodeUpdate: vi.fn(),
    commitShapeNodeRemove: vi.fn(),
    markGestureDragged: () => {
      gestureDragged = true
    },
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    addOverlayChrome,
    requestOverlayPaint: vi.fn(() => {
      paintChrome()
    }),
    requestPaint: vi.fn(() => {
      paintChrome()
    }),
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
    get bandPaintCount() {
      return bandPaintCount
    },
  }
}

describe('CreateEdgeInteraction', () => {
  it('requires Alt by default and creates edge on drop onto another node', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 100, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : { id: 'b', kind: 'node' }),
    })
    const dispose = new CreateEdgeInteraction({ kind: 'data' }).attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10 })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.addOverlayChrome).toHaveBeenCalled()
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).toHaveBeenCalledWith({ from: 'a', to: 'b', kind: 'data' })
    expect(host.rubberBandClears).toBeGreaterThan(0)
    dispose()
  })

  it('exclusive mode (requireAlt false) creates without Alt', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 100, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : { id: 'b', kind: 'node' }),
    })
    const dispose = new CreateEdgeInteraction({ requireAlt: false, kind: 'control' }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10 })
    expect(host.commitEdgeCreate).toHaveBeenCalledWith({ from: 'a', to: 'b', kind: 'control' })
    dispose()
  })

  it('does not create when released on empty space', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 })],
      hitAt: (x) => (x < 50 ? { id: 'a', kind: 'node' } : undefined),
    })
    const dispose = new CreateEdgeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()
    dispose()
  })

  it('creates edge between groups', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [],
      groups: [
        { id: 'g1', label: 'G1', memberIds: [] },
        { id: 'g2', label: 'G2', memberIds: [] },
      ],
      hitAt: (x) => (x < 50 ? { id: 'g1', kind: 'group' } : { id: 'g2', kind: 'group' }),
    })
    const dispose = new CreateEdgeInteraction({ kind: 'data' }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).toHaveBeenCalledWith({ from: 'g1', to: 'g2', kind: 'data' })
    dispose()
  })

  it('does not treat shapeNode hits as valid endpoints', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 0, y: 0 })],
      hitAt: (x) =>
        (x < 50
          ? { id: 'a', kind: 'node' }
          : { id: 'sn1', kind: 'shapeNode' }),
    })
    const dispose = new CreateEdgeInteraction({ kind: 'data' }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()

    // Starting on a shapeNode must not begin an edge gesture.
    canvas.dispatch('pointerdown', { button: 0, clientX: 80, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10, altKey: true })
    expect(host.commitEdgeCreate).not.toHaveBeenCalled()
    dispose()
  })
})

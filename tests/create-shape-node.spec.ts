import { describe, expect, it, vi } from 'vitest'
import { CreateShapeNodeInteraction } from '../src/interaction/create-shape-node.ts'
import { MoveShapeNodeVertexInteraction } from '../src/interaction/move-shape-node-vertex.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphShapeNode } from '../src/protocol/types.ts'

class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: Event) => void>>()
  pointerCaptureIds = new Set<number>()

  addEventListener(type: string, listener: (event: Event) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
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
    partial: Record<string, unknown>,
  ): void {
    const event = {
      pointerId: 1,
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ...partial,
    } as unknown as Event
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

class FakeView {
  private readonly listeners = new Map<string, Set<(event: KeyboardEvent) => void>>()
  tabIndex = -1

  addEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: (event: KeyboardEvent) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string, partial: Partial<KeyboardEvent> & { key: string }): void {
    const event = {
      preventDefault: vi.fn(),
      target: this,
      ...partial,
    } as unknown as KeyboardEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function shapeNode(
  partial: Partial<GraphShapeNode> & Pick<GraphShapeNode, 'id' | 'points'>,
): GraphShapeNode {
  return {
    ...partial,
    id: partial.id,
    points: partial.points,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  view?: FakeView
  shapeNodes?: GraphShapeNode[]
  selectedIds?: string[]
  hitAt?: (x: number, y: number) => {
    id: string
    kind: 'node' | 'shapeNode' | 'edge' | 'group' | 'path'
  } | undefined
}): InteractionHost & {
  commitShapeNodeCreate: ReturnType<typeof vi.fn>
  commitShapeNodeUpdate: ReturnType<typeof vi.fn>
  addOverlayChrome: ReturnType<typeof vi.fn>
  rubberBandClears: number
  closedPreviewSegments: number
} {
  const shapeNodes = new Map((options.shapeNodes ?? []).map(s => [s.id, s]))
  let selectedIds = [...(options.selectedIds ?? [])]
  const commitShapeNodeCreate = vi.fn(() => 'sn-new')
  const commitShapeNodeUpdate = vi.fn((args: {
    shapeNodeId: string
    patch: { points?: readonly { readonly x: number; readonly y: number }[] }
  }) => {
    const existing = shapeNodes.get(args.shapeNodeId)
    if (existing !== undefined && args.patch.points !== undefined) {
      shapeNodes.set(args.shapeNodeId, {
        ...existing,
        points: args.patch.points.map(p => ({ x: p.x, y: p.y })),
      })
    }
  })
  let rubberBandClears = 0
  let closedPreviewSegments = 0
  const chromeList: Array<import('../src/interaction/types.ts').OverlayChrome> = []

  const paintChrome = (): void => {
    closedPreviewSegments = 0
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
      drawEdgeRubberBand: vi.fn((from: { x: number; y: number }, to: { x: number; y: number }) => {
        // Closing edge of a triangle preview: last/cursor back to first point (0,0)
        // after two placed points — count as closed-preview signal.
        if (
          (from.x === 40 && from.y === 60 && to.x === 10 && to.y === 20)
          || (from.x === 10 && from.y === 20 && to.x === 40 && to.y === 60)
        ) {
          closedPreviewSegments += 1
        }
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
    get closedPreviewSegments() {
      return closedPreviewSegments
    },
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => (options.view as unknown as HTMLDivElement) ?? null,
    hitTestScreen: (x, y) => options.hitAt?.(x, y),
    setSelection: vi.fn((ids: readonly string[]) => {
      selectedIds = [...ids]
    }),
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: () => undefined,
    getGroup: () => undefined,
    getNodes: () => [],
    getEdges: () => [],
    getPaths: () => [],
    getShapeNodes: () => [...shapeNodes.values()],
    getElementLayer: () => ({ id: 'default' }),
    isLayerMovable: () => true,
    isLayerEditable: () => true,
    getGroups: () => [],
    getGroupBandBounds: () => undefined,
    getEdgePathBounds: () => undefined,
    getPathBounds: () => undefined,
    getShapeNodeBounds: () => undefined,
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    previewNodeBounds: vi.fn(),
    previewGroupMove: vi.fn(),
    commitGroupMove: vi.fn(),
    toggleGroupExpanded: vi.fn(),
    commitNodeMove: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints: vi.fn(),
    previewPathPoints: vi.fn(),
    previewShapeNodePoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate: vi.fn(),
    commitPathUpdate: vi.fn(),
    commitPathRemove: vi.fn(),
    commitShapeNodeCreate,
    commitShapeNodeUpdate,
    commitShapeNodeRemove: vi.fn(),
    markGestureDragged: vi.fn(),
    wasGestureDragged: () => false,
    clearGestureDragged: vi.fn(),
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
    enterSubNetwork: vi.fn(),
    exitSubNetwork: vi.fn(),
    currentNetworkId: null,
  }
}

describe('CreateShapeNodeInteraction', () => {
  it('two clicks + Enter creates a closed lineto shapeNode', () => {
    const canvas = new FakeHitCanvas()
    const view = new FakeView()
    const host = createHost({ canvas, view, hitAt: () => undefined })
    const dispose = new CreateShapeNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 10, clientY: 20 })
    canvas.dispatch('pointerdown', { clientX: 40, clientY: 60 })
    expect(host.commitShapeNodeCreate).not.toHaveBeenCalled()
    expect(host.addOverlayChrome).toHaveBeenCalled()

    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitShapeNodeCreate).toHaveBeenCalledWith({
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 60 },
      ],
      closed: true,
      style: { shapeKind: 'lineto' },
    })
    expect(host.rubberBandClears).toBeGreaterThan(0)
    dispose()
  })

  it('double-click commits when ≥2 points', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({ canvas, hitAt: () => undefined })
    const dispose = new CreateShapeNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 0, clientY: 0 })
    canvas.dispatch('pointerdown', { clientX: 30, clientY: 0 })
    canvas.dispatch('dblclick', { clientX: 30, clientY: 0 })
    expect(host.commitShapeNodeCreate).toHaveBeenCalledWith({
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      closed: true,
      style: { shapeKind: 'lineto' },
    })
    dispose()
  })

  it('Esc cancels without commit', () => {
    const canvas = new FakeHitCanvas()
    const view = new FakeView()
    const host = createHost({ canvas, view, hitAt: () => undefined })
    const dispose = new CreateShapeNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 10, clientY: 10 })
    canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 })
    view.dispatch('keydown', { key: 'Escape' })
    expect(host.commitShapeNodeCreate).not.toHaveBeenCalled()
    expect(host.rubberBandClears).toBeGreaterThan(0)

    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitShapeNodeCreate).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores clicks on existing elements', () => {
    const canvas = new FakeHitCanvas()
    const view = new FakeView()
    const host = createHost({
      canvas,
      view,
      hitAt: () => ({ id: 'n1', kind: 'node' }),
    })
    const dispose = new CreateShapeNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { clientX: 10, clientY: 10 })
    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitShapeNodeCreate).not.toHaveBeenCalled()
    dispose()
  })

  it('closed preview draws rubber band back to the first point', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({ canvas, hitAt: () => undefined })
    const dispose = new CreateShapeNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 10, clientY: 20 })
    canvas.dispatch('pointerdown', { clientX: 40, clientY: 60 })
    // cursor still at last point → closing segment last→first
    expect(host.closedPreviewSegments).toBeGreaterThan(0)
    dispose()
  })
})

describe('MoveShapeNodeVertexInteraction', () => {
  it('drags a control handle and commits updated points', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      shapeNodes: [shapeNode({
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ],
      })],
      selectedIds: ['sn1'],
    })
    const dispose = new MoveShapeNodeVertexInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 100, clientY: 0 })
    canvas.dispatch('pointermove', { clientX: 120, clientY: 10 })
    canvas.dispatch('pointerup', { clientX: 120, clientY: 10 })

    expect(host.commitShapeNodeUpdate).toHaveBeenCalledWith({
      shapeNodeId: 'sn1',
      patch: {
        points: [
          { x: 0, y: 0 },
          { x: 120, y: 10 },
          { x: 100, y: 50 },
        ],
      },
    })
    dispose()
  })

  it('ignores locked shapeNodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      shapeNodes: [shapeNode({
        id: 'sn1',
        locked: true,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      })],
      selectedIds: ['sn1'],
    })
    const dispose = new MoveShapeNodeVertexInteraction().attach(host)
    canvas.dispatch('pointerdown', { clientX: 100, clientY: 0 })
    canvas.dispatch('pointermove', { clientX: 120, clientY: 10 })
    canvas.dispatch('pointerup', { clientX: 120, clientY: 10 })
    expect(host.commitShapeNodeUpdate).not.toHaveBeenCalled()
    dispose()
  })
})

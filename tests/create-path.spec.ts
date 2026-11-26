import { describe, expect, it, vi } from 'vitest'
import { CreatePathInteraction } from '../src/interaction/create-path.ts'
import { MovePathVertexInteraction } from '../src/interaction/move-path-vertex.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphPath } from '../src/protocol/types.ts'

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

function path(partial: Partial<GraphPath> & Pick<GraphPath, 'id' | 'points'>): GraphPath {
  return {
    ...partial,
    id: partial.id,
    points: partial.points,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  view?: FakeView
  paths?: GraphPath[]
  selectedIds?: string[]
  hitAt?: (x: number, y: number) => { id: string; kind: 'node' | 'edge' | 'group' | 'path' } | undefined
}): InteractionHost & {
  commitPathCreate: ReturnType<typeof vi.fn>
  commitPathUpdate: ReturnType<typeof vi.fn>
  addOverlayChrome: ReturnType<typeof vi.fn>
  rubberBandClears: number
} {
  const paths = new Map((options.paths ?? []).map(p => [p.id, p]))
  let selectedIds = [...(options.selectedIds ?? [])]
  const commitPathCreate = vi.fn(() => 'p-new')
  const commitPathUpdate = vi.fn((args: {
    pathId: string
    patch: { points?: readonly { readonly x: number; readonly y: number }[] }
  }) => {
    const existing = paths.get(args.pathId)
    if (existing !== undefined && args.patch.points !== undefined) {
      paths.set(args.pathId, { ...existing, points: args.patch.points.map(p => ({ x: p.x, y: p.y })) })
    }
  })
  let rubberBandClears = 0
  const chromeList: Array<import('../src/interaction/types.ts').OverlayChrome> = []

  const paintChrome = (): void => {
    const renderer = {
      beginFrame: vi.fn(),
      drawGroup: vi.fn(),
      drawEdge: vi.fn(),
      drawPath: vi.fn(),
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
    getPaths: () => [...paths.values()],
    getGroups: () => [],
    getGroupBandBounds: () => undefined,
    getEdgePathBounds: () => undefined,
    getPathBounds: () => undefined,
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
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate,
    commitPathUpdate,
    commitPathRemove: vi.fn(),
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

describe('CreatePathInteraction', () => {
  it('two clicks + Enter creates a path with lineto style', () => {
    const canvas = new FakeHitCanvas()
    const view = new FakeView()
    const host = createHost({ canvas, view, hitAt: () => undefined })
    const dispose = new CreatePathInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 10, clientY: 20 })
    canvas.dispatch('pointerdown', { clientX: 40, clientY: 60 })
    expect(host.commitPathCreate).not.toHaveBeenCalled()
    expect(host.addOverlayChrome).toHaveBeenCalled()

    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitPathCreate).toHaveBeenCalledWith({
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 60 },
      ],
      style: { shapeKind: 'lineto' },
    })
    expect(host.rubberBandClears).toBeGreaterThan(0)
    dispose()
  })

  it('double-click commits when ≥2 points', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({ canvas, hitAt: () => undefined })
    const dispose = new CreatePathInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 0, clientY: 0 })
    canvas.dispatch('pointerdown', { clientX: 30, clientY: 0 })
    canvas.dispatch('dblclick', { clientX: 30, clientY: 0 })
    expect(host.commitPathCreate).toHaveBeenCalledWith({
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      style: { shapeKind: 'lineto' },
    })
    dispose()
  })

  it('Esc cancels without commit', () => {
    const canvas = new FakeHitCanvas()
    const view = new FakeView()
    const host = createHost({ canvas, view, hitAt: () => undefined })
    const dispose = new CreatePathInteraction().attach(host)

    canvas.dispatch('pointerdown', { clientX: 10, clientY: 10 })
    canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 })
    view.dispatch('keydown', { key: 'Escape' })
    expect(host.commitPathCreate).not.toHaveBeenCalled()
    expect(host.rubberBandClears).toBeGreaterThan(0)

    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitPathCreate).not.toHaveBeenCalled()
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
    const dispose = new CreatePathInteraction().attach(host)
    canvas.dispatch('pointerdown', { clientX: 10, clientY: 10 })
    view.dispatch('keydown', { key: 'Enter' })
    expect(host.commitPathCreate).not.toHaveBeenCalled()
    dispose()
  })
})

describe('MovePathVertexInteraction', () => {
  it('drags a control handle and commits updated points', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      paths: [path({
        id: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ],
      })],
      selectedIds: ['p1'],
    })
    const dispose = new MovePathVertexInteraction().attach(host)

    // Hit the middle vertex at (100, 0) and drag to (120, 10).
    canvas.dispatch('pointerdown', { clientX: 100, clientY: 0 })
    canvas.dispatch('pointermove', { clientX: 120, clientY: 10 })
    canvas.dispatch('pointerup', { clientX: 120, clientY: 10 })

    expect(host.commitPathUpdate).toHaveBeenCalledWith({
      pathId: 'p1',
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

  it('ignores locked paths', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      paths: [path({
        id: 'p1',
        locked: true,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      })],
      selectedIds: ['p1'],
    })
    const dispose = new MovePathVertexInteraction().attach(host)
    canvas.dispatch('pointerdown', { clientX: 100, clientY: 0 })
    canvas.dispatch('pointermove', { clientX: 120, clientY: 10 })
    canvas.dispatch('pointerup', { clientX: 120, clientY: 10 })
    expect(host.commitPathUpdate).not.toHaveBeenCalled()
    dispose()
  })
})

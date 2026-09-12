import { describe, expect, it, vi } from 'vitest'
import {
  MoveEdgeBendInteraction,
  moveOrthogonalCorner,
} from '../src/interaction/move-edge-bend.ts'
import type { InteractionHost, OverlayChrome } from '../src/interaction/types.ts'
import type { GraphEdge, GraphNode } from '../src/protocol/types.ts'
import { edgeAnchors } from '../src/ui/bounds.ts'

class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()
  private readonly captureListeners = new Map<string, Set<(event: PointerEvent) => void>>()

  addEventListener(
    type: string,
    listener: (event: PointerEvent) => void,
    options?: boolean | { capture?: boolean },
  ): void {
    const capture = options === true || (typeof options === 'object' && options.capture === true)
    const map = capture ? this.captureListeners : this.listeners
    let set = map.get(type)
    if (set === undefined) {
      set = new Set()
      map.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(
    type: string,
    listener: (event: PointerEvent) => void,
    options?: boolean | { capture?: boolean },
  ): void {
    const capture = options === true || (typeof options === 'object' && options.capture === true)
    const map = capture ? this.captureListeners : this.listeners
    map.get(type)?.delete(listener)
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400,
      toJSON: () => ({}),
    }
  }

  setPointerCapture(): void {}
  releasePointerCapture(): void {}

  dispatch(
    type: string,
    partial: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'> & { pointerId?: number },
  ): void {
    const event = {
      pointerId: 1,
      altKey: false,
      stopPropagation: vi.fn(),
      ...partial,
    } as unknown as PointerEvent
    for (const listener of this.captureListeners.get(type) ?? []) listener(event)
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedIds?: string[]
}): InteractionHost & {
  previewEdgeWaypoints: ReturnType<typeof vi.fn>
  commitEdgeWaypoints: ReturnType<typeof vi.fn>
  handlePaints: number
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  const edges = new Map(options.edges.map(e => [e.id, { ...e }]))
  let selectedIds = [...(options.selectedIds ?? [])]
  let gestureDragged = false
  let handlePaints = 0
  const chromeList: OverlayChrome[] = []

  const previewEdgeWaypoints = vi.fn((
    edgeId: string,
    waypoints: readonly { readonly x: number; readonly y: number }[],
  ) => {
    const current = edges.get(edgeId)
    if (current === undefined) return
    edges.set(edgeId, {
      ...current,
      waypoints: waypoints.map(p => ({ x: p.x, y: p.y })),
    })
  })
  const commitEdgeWaypoints = vi.fn()

  const paintChrome = (): void => {
    const renderer = {
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
      drawEdgeBendHandle: vi.fn(() => {
        handlePaints += 1
      }),
    }
    for (const chrome of chromeList) chrome.paint(renderer)
  }

  return {
    get handlePaints() {
      return handlePaints
    },
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () => undefined,
    setSelection: vi.fn((ids: readonly string[]) => {
      selectedIds = [...ids]
    }),
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.get(id),
    getNodes: () => [...nodes.values()],
    getEdges: () => [...edges.values()],
    getGroups: () => [],
    getGroupBandBounds: () => ({ x: 0, y: 0, width: 100, height: 80 }),
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    previewNodeBounds: vi.fn(),
    commitNodeMove: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints,
    commitEdgeWaypoints,
    markGestureDragged: () => {
      gestureDragged = true
    },
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    addOverlayChrome: (chrome) => {
      chromeList.push(chrome)
      paintChrome()
      return () => {
        const index = chromeList.indexOf(chrome)
        if (index >= 0) chromeList.splice(index, 1)
        paintChrome()
      }
    },
    requestOverlayPaint: () => {
      paintChrome()
    },
    requestPaint: () => {
      paintChrome()
    },
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

describe('moveOrthogonalCorner', () => {
  it('moves shared midX for an HV elbow', () => {
    const full = [
      { x: 100, y: 20 },
      { x: 150, y: 20 },
      { x: 150, y: 60 },
      { x: 200, y: 60 },
    ]
    const next = moveOrthogonalCorner(full, 1, { x: 170, y: 99 })
    expect(next[1]).toEqual({ x: 170, y: 20 })
    expect(next[2]).toEqual({ x: 170, y: 60 })
  })
})

describe('MoveEdgeBendInteraction', () => {
  it('paints bend handles for a selected edge', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 100, h: 40 },
        { id: 'b', type: 'unit', label: 'B', x: 200, y: 40, w: 100, h: 40 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      selectedIds: ['e1'],
    })
    const dispose = new MoveEdgeBendInteraction().attach(host)
    expect(host.handlePaints).toBeGreaterThan(0)
    dispose()
  })

  it('seeds auto waypoints then commits after drag', () => {
    const canvas = new FakeHitCanvas()
    const nodes: GraphNode[] = [
      { id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 100, h: 40 },
      { id: 'b', type: 'unit', label: 'B', x: 200, y: 40, w: 100, h: 40 },
    ]
    const host = createHost({
      canvas,
      nodes,
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      selectedIds: ['e1'],
    })
    const dispose = new MoveEdgeBendInteraction().attach(host)
    const route = edgeAnchors(nodes[0]!, nodes[1]!)
    const handle = route.points[1]!
    canvas.dispatch('pointerdown', { button: 0, clientX: handle.x, clientY: handle.y })
    expect(host.previewEdgeWaypoints).toHaveBeenCalled()
    canvas.dispatch('pointermove', { button: 0, clientX: handle.x + 40, clientY: handle.y })
    canvas.dispatch('pointerup', { button: 0, clientX: handle.x + 40, clientY: handle.y })
    expect(host.commitEdgeWaypoints).toHaveBeenCalled()
    const args = host.commitEdgeWaypoints.mock.calls.at(-1)?.[0] as {
      edgeId: string
      from: readonly { x: number; y: number }[]
      to: readonly { x: number; y: number }[]
    }
    expect(args.edgeId).toBe('e1')
    expect(args.from).toEqual([])
    expect(args.to.length).toBeGreaterThan(0)
    dispose()
  })
})

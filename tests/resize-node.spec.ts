import { describe, expect, it, vi } from 'vitest'
import { ResizeNodeInteraction } from '../src/interaction/resize-node.ts'
import type { InteractionHost, OverlayChrome } from '../src/interaction/types.ts'
import type { GraphNode } from '../src/protocol/types.ts'

class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()
  private readonly captureListeners = new Map<string, Set<(event: PointerEvent) => void>>()
  pointerCaptureIds = new Set<number>()

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

  setPointerCapture(pointerId: number): void {
    this.pointerCaptureIds.add(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.pointerCaptureIds.delete(pointerId)
  }

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

function node(partial: Partial<GraphNode> & Pick<GraphNode, 'id'>): GraphNode {
  return {
    type: 'u',
    label: partial.id,
    x: 0,
    y: 0,
    w: 100,
    h: 40,
    ...partial,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  selectedIds?: string[]
}): InteractionHost & {
  commitNodeResize: ReturnType<typeof vi.fn>
  previewNodeBounds: ReturnType<typeof vi.fn>
  handlePaints: number
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  let selectedIds = [...(options.selectedIds ?? [])]
  let gestureDragged = false
  let handlePaints = 0
  const chromeList: OverlayChrome[] = []

  const previewNodeBounds = vi.fn((id: string, bounds: { x: number; y: number; w: number; h: number }) => {
    const current = nodes.get(id)
    if (current === undefined) return
    nodes.set(id, { ...current, ...bounds })
  })
  const commitNodeResize = vi.fn()

  const paintChrome = (): void => {
    const renderer = {
      beginFrame: vi.fn(),
      drawGroup: vi.fn(),
      drawEdge: vi.fn(),
      drawNode: vi.fn(),
      endFrame: vi.fn(),
      drawSelectionOverlay: vi.fn(),
      drawMarquee: vi.fn(),
      drawEdgeRubberBand: vi.fn(),
      drawLazyMoveGhost: vi.fn(),
      drawDropTargetHighlight: vi.fn(),
      drawResizeHandle: vi.fn(() => {
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
    getEdges: () => [],
    getGroups: () => [],
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    previewNodeBounds,
    commitNodeMove: vi.fn(),
    commitNodeResize,
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
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
    requestPaint: () => {
      paintChrome()
    },
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

describe('ResizeNodeInteraction', () => {
  it('paints handles for selected unlocked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a' }), node({ id: 'locked', locked: true })],
      selectedIds: ['a', 'locked'],
    })
    const dispose = new ResizeNodeInteraction().attach(host)
    expect(host.handlePaints).toBe(4)
    dispose()
  })

  it('resizes from SE corner and commits', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20, w: 100, h: 40 })],
      selectedIds: ['a'],
    })
    const dispose = new ResizeNodeInteraction().attach(host)

    // SE corner at (110, 60)
    canvas.dispatch('pointerdown', { button: 0, clientX: 110, clientY: 60 })
    canvas.dispatch('pointermove', { button: 0, clientX: 130, clientY: 80 })
    expect(host.previewNodeBounds).toHaveBeenCalled()
    canvas.dispatch('pointerup', { button: 0, clientX: 130, clientY: 80 })
    expect(host.commitNodeResize).toHaveBeenCalledWith({
      nodeId: 'a',
      from: { x: 10, y: 20, w: 100, h: 40 },
      to: { x: 10, y: 20, w: 120, h: 60 },
    })
    dispose()
  })

  it('ignores locked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'locked', locked: true, x: 10, y: 20, w: 100, h: 40 })],
      selectedIds: ['locked'],
    })
    const dispose = new ResizeNodeInteraction().attach(host)
    expect(host.handlePaints).toBe(0)
    canvas.dispatch('pointerdown', { button: 0, clientX: 110, clientY: 60 })
    canvas.dispatch('pointerup', { button: 0, clientX: 130, clientY: 80 })
    expect(host.commitNodeResize).not.toHaveBeenCalled()
    dispose()
  })
})

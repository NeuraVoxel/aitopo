import { describe, expect, it, vi } from 'vitest'
import { MarqueeSelectInteraction } from '../src/interaction/marquee-select.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../src/protocol/types.ts'
import type { Rect } from '../src/geom.ts'

/** Minimal EventTarget-like canvas for node-env MarqueeSelect tests. */
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
      shiftKey?: boolean
      ctrlKey?: boolean
      metaKey?: boolean
    },
  ): void {
    const event = {
      pointerId: 1,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => {},
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
  nodes?: GraphNode[]
  groups?: GraphGroup[]
  edges?: GraphEdge[]
  groupBounds?: Record<string, Rect>
  edgeBounds?: Record<string, Rect>
  hitId?: string
}): InteractionHost & {
  setSelection: ReturnType<typeof vi.fn>
  addOverlayChrome: ReturnType<typeof vi.fn>
  markGestureDragged: ReturnType<typeof vi.fn>
  marqueeRects: Array<Rect | undefined>
} {
  const nodes = [...(options.nodes ?? [])]
  const groups = [...(options.groups ?? [])]
  const edges = [...(options.edges ?? [])]
  const hitId = options.hitId
  let gestureDragged = false
  let selectedIds: string[] = []
  const marqueeRects: Array<Rect | undefined> = []
  const chromeList: Array<import('../src/interaction/types.ts').OverlayChrome> = []

  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })
  const markGestureDragged = vi.fn(() => {
    gestureDragged = true
  })

  const paintChrome = (): void => {
    const drawMarquee = (rect: Rect): void => {
      marqueeRects.push(rect)
    }
    const renderer = {
      beginFrame: vi.fn(),
      drawGroup: vi.fn(),
      drawEdge: vi.fn(),
      drawNode: vi.fn(),
      endFrame: vi.fn(),
      drawSelectionOverlay: vi.fn(),
      drawHoverOverlay: vi.fn(),
      drawMarquee,
      drawEdgeRubberBand: vi.fn(),
      drawLazyMoveGhost: vi.fn(),
      drawResizeHandle: vi.fn(),
      drawEdgeBendHandle: vi.fn(),
    }
    if (chromeList.length === 0) {
      marqueeRects.push(undefined)
      return
    }
    for (const chrome of chromeList) chrome.paint(renderer)
  }

  const addOverlayChrome = vi.fn((chrome: import('../src/interaction/types.ts').OverlayChrome) => {
    chromeList.push(chrome)
    paintChrome()
    return () => {
      const index = chromeList.indexOf(chrome)
      if (index >= 0) chromeList.splice(index, 1)
      paintChrome()
    }
  })

  return {
    marqueeRects,
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () =>
      hitId === undefined ? undefined : { id: hitId, kind: 'node' as const },
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.find(n => n.id === id),
    getGroup: id => groups.find(g => g.id === id),
    getNodes: () => nodes,
    getEdges: () => edges,
    getGroups: () => groups,
    getGroupBandBounds: id => options.groupBounds?.[id],
    getEdgePathBounds: id => options.edgeBounds?.[id],
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition: vi.fn(),
    previewNodeBounds: vi.fn(),
    previewGroupMove: vi.fn(),
    commitNodeMove: vi.fn(),
    commitGroupMove: vi.fn(),
    toggleGroupExpanded: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    markGestureDragged,
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
    enterSubNetwork: vi.fn(),
    exitSubNetwork: vi.fn(),
    currentNetworkId: null,
  }
}

function dragMarquee(
  canvas: FakeHitCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
  mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
): void {
  canvas.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y, ...mods })
  canvas.dispatch('pointermove', { button: 0, clientX: to.x, clientY: to.y, ...mods })
  canvas.dispatch('pointerup', { button: 0, clientX: to.x, clientY: to.y, ...mods })
}

describe('MarqueeSelectInteraction', () => {
  it('Shift+empty drag selects intersecting nodes (replace)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'in', x: 20, y: 20 }),
        node({ id: 'out', x: 200, y: 200 }),
      ],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 }, { shiftKey: true })

    expect(host.setSelection).toHaveBeenCalledWith(['in'])
    expect(host.marqueeRects.at(-1)).toBeUndefined()
    dispose()
  })

  it('Ctrl+empty drag starts marquee (twaver path)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 }, { ctrlKey: true })

    expect(host.setSelection).toHaveBeenCalledWith(['a'])
    dispose()
  })

  it('selects locked nodes whose bounds intersect', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'locked', locked: true, x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 60, y: 60 }, { shiftKey: true })

    expect(host.setSelection).toHaveBeenCalledWith(['locked'])
    dispose()
  })

  it('selects intersecting groups and edges', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'n', x: 200, y: 200 })],
      groups: [{ id: 'g', label: 'G', memberIds: [], x: 10, y: 10, w: 50, h: 40 }],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
      groupBounds: { g: { x: 10, y: 10, width: 50, height: 40 } },
      edgeBounds: { e: { x: 15, y: 15, width: 20, height: 10 } },
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 }, { shiftKey: true })

    expect(host.setSelection).toHaveBeenCalledWith(['g', 'e'])
    dispose()
  })

  it('up-left drag uses contain mode (skips partial overlaps)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'partial', x: 0, y: 0, w: 40, h: 40 }),
        node({ id: 'inside', x: 30, y: 30, w: 20, h: 20 }),
      ],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    // start (100,100) → end (20,20): up-left → contain
    dragMarquee(canvas, { x: 100, y: 100 }, { x: 20, y: 20 }, { shiftKey: true })

    expect(host.setSelection).toHaveBeenCalledWith(['inside'])
    dispose()
  })

  it('without modifiers does nothing', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0, shiftKey: false })
    canvas.dispatch('pointermove', { button: 0, clientX: 80, clientY: 80 })
    canvas.dispatch('pointerup', { button: 0, clientX: 80, clientY: 80 })

    expect(host.setSelection).not.toHaveBeenCalled()
    expect(host.addOverlayChrome).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores Shift+drag when hitTestScreen finds a node', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
      hitId: 'a',
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 }, { shiftKey: true })

    expect(host.setSelection).not.toHaveBeenCalled()
    expect(host.addOverlayChrome).not.toHaveBeenCalled()
    dispose()
  })

  it('updates marquee rect during drag past threshold', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 10 })],
    })
    const dispose = new MarqueeSelectInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0, shiftKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 2, clientY: 0, shiftKey: true })
    expect(host.addOverlayChrome).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()

    canvas.dispatch('pointermove', { button: 0, clientX: 50, clientY: 40, shiftKey: true })
    expect(host.markGestureDragged).toHaveBeenCalledTimes(1)
    expect(host.addOverlayChrome).toHaveBeenCalledTimes(1)
    expect(host.marqueeRects).toContainEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 40,
    })
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)

    canvas.dispatch('pointerup', { button: 0, clientX: 50, clientY: 40, shiftKey: true })
    expect(host.marqueeRects.at(-1)).toBeUndefined()
    dispose()
  })

  it('Ctrl marquee XORs intersecting ids with the current selection', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'keep', x: 200, y: 200 }),
        node({ id: 'add', x: 20, y: 20 }),
        node({ id: 'drop', x: 25, y: 25 }),
      ],
    })
    host.setSelection(['keep', 'drop'])
    const dispose = new MarqueeSelectInteraction().attach(host)

    dragMarquee(canvas, { x: 0, y: 0 }, { x: 80, y: 80 }, { ctrlKey: true })

    // drop was selected and in band → removed; add was not → added; keep outside → stays
    expect(host.setSelection).toHaveBeenLastCalledWith(['keep', 'add'])
    dispose()
  })
})

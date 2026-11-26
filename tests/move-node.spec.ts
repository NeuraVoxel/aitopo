import { describe, expect, it, vi } from 'vitest'
import { MoveNodeInteraction } from '../src/interaction/move-node.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphNode } from '../src/protocol/types.ts'

/** Minimal EventTarget-like canvas for node-env MoveNode tests. */
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
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
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
    ...partial,
  }
}

function createHost(options: {
  canvas: FakeHitCanvas
  nodes: GraphNode[]
  selectedIds?: string[]
  hitId?: string
  hitKind?: 'node' | 'group' | 'path' | 'shapeNode'
  groupOnUp?: string | undefined
  zoom?: number
  groups?: import('../src/protocol/types.ts').GraphGroup[]
  paths?: import('../src/protocol/types.ts').GraphPath[]
  shapeNodes?: import('../src/protocol/types.ts').GraphShapeNode[]
}): InteractionHost & {
  commitNodeMove: ReturnType<typeof vi.fn>
  commitPathUpdate: ReturnType<typeof vi.fn>
  commitShapeNodeUpdate: ReturnType<typeof vi.fn>
  previewNodePosition: ReturnType<typeof vi.fn>
  markGestureDragged: ReturnType<typeof vi.fn>
  setSelection: ReturnType<typeof vi.fn>
  setDragPaintFilter: ReturnType<typeof vi.fn>
  addOverlayChrome: ReturnType<typeof vi.fn>
  ghostPaints: number
  dropTargetPaints: number
} {
  const nodes = new Map(options.nodes.map(n => [n.id, n]))
  const groups = [...(options.groups ?? [])]
  const paths = [...(options.paths ?? [])]
  const shapeNodes = [...(options.shapeNodes ?? [])]
  let selectedIds = [...(options.selectedIds ?? [])]
  let gestureDragged = false
  const hitId = options.hitId
    ?? options.nodes[0]?.id
    ?? options.paths?.[0]?.id
    ?? options.shapeNodes?.[0]?.id
  const hitKind = options.hitKind ?? 'node'
  const zoom = options.zoom ?? 1
  let groupOnUp = options.groupOnUp
  let ghostPaints = 0
  let dropTargetPaints = 0
  const chromeList: Array<import('../src/interaction/types.ts').OverlayChrome> = []

  const commitNodeMove = vi.fn()
  const commitPathUpdate = vi.fn()
  const commitShapeNodeUpdate = vi.fn()
  const previewNodePosition = vi.fn()
  const previewPathPoints = vi.fn()
  const previewShapeNodePoints = vi.fn()
  const markGestureDragged = vi.fn(() => {
    gestureDragged = true
  })
  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })
  const setDragPaintFilter = vi.fn()

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
      drawEdgeRubberBand: vi.fn(),
      drawLazyMoveGhost: vi.fn(() => {
        ghostPaints += 1
      }),
      drawSelectionOverlay: vi.fn(() => {
        dropTargetPaints += 1
      }),
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
      paintChrome()
    }
  })

  return {
    get ghostPaints() {
      return ghostPaints
    },
    get dropTargetPaints() {
      return dropTargetPaints
    },
    getHitElement: () => options.canvas as unknown as HTMLCanvasElement,
    getViewElement: () => null,
    hitTestScreen: () =>
      hitId === undefined ? undefined : { id: hitId, kind: hitKind },
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: id => nodes.get(id),
    getGroup: id => groups.find(g => g.id === id),
    getNodes: () => [...nodes.values()],
    getEdges: () => [],
    getPaths: () => paths,
    getShapeNodes: () => shapeNodes,
    getGroups: () => groups,
    getGroupBandBounds: () => ({ x: 0, y: 0, width: 100, height: 80 }),
    getEdgePathBounds: () => undefined,
    getPathBounds: () => undefined,
    getShapeNodeBounds: () => undefined,
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => groupOnUp,
    screenToWorld: (x, y) => ({ x, y }),
    previewNodePosition,
    previewNodeBounds: vi.fn(),
    previewGroupMove: vi.fn(),
    previewPathPoints,
    previewShapeNodePoints,
    commitNodeMove,
    commitGroupMove: vi.fn(),
    toggleGroupExpanded: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate: vi.fn(),
    commitPathUpdate,
    commitPathRemove: vi.fn(),
    commitShapeNodeCreate: vi.fn(),
    commitShapeNodeUpdate,
    commitShapeNodeRemove: vi.fn(),
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
    setDragPaintFilter,
    emit: vi.fn(),
    apply: vi.fn(),
  }
}

function dragPastThreshold(
  canvas: FakeHitCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.dispatch('pointerdown', { button: 0, clientX: from.x, clientY: from.y })
  canvas.dispatch('pointermove', { button: 0, clientX: to.x, clientY: to.y })
  canvas.dispatch('pointerup', { button: 0, clientX: to.x, clientY: to.y })
}

describe('MoveNodeInteraction', () => {
  it('skips locked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', locked: true, x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).not.toHaveBeenCalled()
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    dispose()
  })

  it('commits unlocked move with nodeId and from', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 20 },
      }),
    )
    dispose()
  })

  it('passes toGroupId from hitTestGroupScreen on up', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20, groupId: 'g1' })],
      selectedIds: ['a'],
      hitId: 'a',
      groupOnUp: 'g2',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 40, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        toGroupId: 'g2',
      }),
    )
    dispose()
  })

  it('moves multi-select unlocked nodes with shared delta', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 }), node({ id: 'b', x: 50, y: 60 })],
      selectedIds: ['a', 'b'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 20 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(2)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 30 },
      }),
    )
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'b',
        from: { x: 50, y: 60 },
        to: { x: 70, y: 70 },
      }),
    )
    dispose()
  })

  it('calls markGestureDragged once threshold crossed', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 12, clientY: 10 })
    expect(host.markGestureDragged).not.toHaveBeenCalled()
    expect(host.previewNodePosition).not.toHaveBeenCalled()

    canvas.dispatch('pointermove', { button: 0, clientX: 14, clientY: 10 })
    expect(host.markGestureDragged).toHaveBeenCalledTimes(1)
    expect(host.previewNodePosition).toHaveBeenCalled()
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)

    canvas.dispatch('pointerup', { button: 0, clientX: 14, clientY: 10 })
    dispose()
  })

  it('hit locked node already in selection with unlocked sibling commits only unlocked', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'locked', locked: true, x: 10, y: 20 }),
        node({ id: 'free', x: 50, y: 60 }),
      ],
      selectedIds: ['locked', 'free'],
      hitId: 'locked',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 20 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(1)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'free',
        from: { x: 50, y: 60 },
        to: { x: 70, y: 70 },
      }),
    )
    expect(host.commitNodeMove).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'locked' }),
    )
    dispose()
  })

  it('multi-select with one locked commits only unlocked nodes', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'a', x: 10, y: 20 }),
        node({ id: 'b', locked: true, x: 40, y: 50 }),
        node({ id: 'c', x: 70, y: 80 }),
      ],
      selectedIds: ['a', 'b', 'c'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })

    expect(host.commitNodeMove).toHaveBeenCalledTimes(2)
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'a',
        from: { x: 10, y: 20 },
        to: { x: 30, y: 20 },
      }),
    )
    expect(host.commitNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'c',
        from: { x: 70, y: 80 },
        to: { x: 90, y: 80 },
      }),
    )
    expect(host.commitNodeMove).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'b' }),
    )
    dispose()
  })

  it('dispose mid-drag reverts preview and releases pointer capture', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    expect(canvas.pointerCaptureIds.has(1)).toBe(true)
    expect(host.previewNodePosition).toHaveBeenCalledWith('a', 30, 20)

    dispose()

    expect(canvas.pointerCaptureIds.has(1)).toBe(false)
    expect(host.previewNodePosition).toHaveBeenLastCalledWith('a', 10, 20)
    expect(host.commitNodeMove).not.toHaveBeenCalled()
  })

  it('pointercancel mid-drag reverts preview without commit', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    canvas.dispatch('pointercancel', { button: 0, clientX: 30, clientY: 10 })

    expect(canvas.pointerCaptureIds.has(1)).toBe(false)
    expect(host.previewNodePosition).toHaveBeenLastCalledWith('a', 10, 20)
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores Alt+pointerdown (CreateEdge owns that gesture)', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, altKey: true })
    canvas.dispatch('pointermove', { button: 0, clientX: 40, clientY: 10, altKey: true })
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 10, altKey: true })
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    expect(host.setDragPaintFilter).not.toHaveBeenCalled()
    dispose()
  })

  it('default does not set drag paint filter while dragging', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    dragPastThreshold(canvas, { x: 10, y: 10 }, { x: 30, y: 10 })
    expect(host.setDragPaintFilter).not.toHaveBeenCalled()
    dispose()
  })

  it('hideOthersWhileDragging sets and clears paint filter', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction({ hideOthersWhileDragging: true }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 30, clientY: 10 })
    expect(host.setDragPaintFilter).toHaveBeenCalledWith(['a'])
    canvas.dispatch('pointerup', { button: 0, clientX: 30, clientY: 10 })
    expect(host.setDragPaintFilter).toHaveBeenLastCalledWith(undefined)
    dispose()
  })

  it('lazyMove does not preview positions and paints ghosts', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20, w: 40, h: 40 })],
      selectedIds: ['a'],
      hitId: 'a',
    })
    const dispose = new MoveNodeInteraction({ lazyMove: true }).attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 40, clientY: 10 })
    expect(host.previewNodePosition).not.toHaveBeenCalled()
    expect(host.ghostPaints).toBeGreaterThan(0)
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 10 })
    expect(host.commitNodeMove).toHaveBeenCalled()
    dispose()
  })

  it('highlights drop-target group while dragging', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20 })],
      selectedIds: ['a'],
      hitId: 'a',
      groupOnUp: 'g1',
      groups: [{ id: 'g1', label: 'G', memberIds: [], x: 0, y: 0, w: 100, h: 80 }],
    })
    const dispose = new MoveNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 40, clientY: 10 })
    expect(host.dropTargetPaints).toBeGreaterThan(0)
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 10 })
    dispose()
  })

  it('does not highlight the group a dragged node already belongs to', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [node({ id: 'a', x: 10, y: 20, groupId: 'g1' })],
      selectedIds: ['a'],
      hitId: 'a',
      groupOnUp: 'g1',
      groups: [{ id: 'g1', label: 'G', memberIds: ['a'], x: 0, y: 0, w: 100, h: 80 }],
    })
    const dispose = new MoveNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 40, clientY: 10 })
    expect(host.dropTargetPaints).toBe(0)
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 10 })
    dispose()
  })

  it('highlights when at least one selected mover would join the group', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [
        node({ id: 'a', x: 10, y: 20, groupId: 'g1' }),
        node({ id: 'b', x: 60, y: 20 }),
      ],
      selectedIds: ['a', 'b'],
      hitId: 'b',
      groupOnUp: 'g1',
      groups: [{ id: 'g1', label: 'G', memberIds: ['a'], x: 0, y: 0, w: 100, h: 80 }],
    })
    const dispose = new MoveNodeInteraction().attach(host)
    canvas.dispatch('pointerdown', { button: 0, clientX: 60, clientY: 10 })
    canvas.dispatch('pointermove', { button: 0, clientX: 90, clientY: 10 })
    expect(host.dropTargetPaints).toBeGreaterThan(0)
    canvas.dispatch('pointerup', { button: 0, clientX: 90, clientY: 10 })
    dispose()
  })

  it('translates all path control points on body drag', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [],
      paths: [{
        id: 'p1',
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 50 },
        ],
      }],
      selectedIds: ['p1'],
      hitId: 'p1',
      hitKind: 'path',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 20, y: 20 }, { x: 40, y: 30 })

    expect(host.previewPathPoints).toHaveBeenCalled()
    expect(host.commitPathUpdate).toHaveBeenCalledWith({
      pathId: 'p1',
      patch: {
        points: [
          { x: 30, y: 30 },
          { x: 60, y: 30 },
          { x: 60, y: 60 },
        ],
      },
    })
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    dispose()
  })

  it('skips locked path body drag', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [],
      paths: [{
        id: 'p1',
        locked: true,
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
        ],
      }],
      selectedIds: ['p1'],
      hitId: 'p1',
      hitKind: 'path',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    dragPastThreshold(canvas, { x: 20, y: 20 }, { x: 40, y: 30 })
    expect(host.commitPathUpdate).not.toHaveBeenCalled()
    dispose()
  })

  it('translates all shapeNode control points on body drag', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 50 },
        ],
      }],
      selectedIds: ['sn1'],
      hitId: 'sn1',
      hitKind: 'shapeNode',
    })
    const dispose = new MoveNodeInteraction().attach(host)

    dragPastThreshold(canvas, { x: 20, y: 20 }, { x: 40, y: 30 })

    expect(host.previewShapeNodePoints).toHaveBeenCalled()
    expect(host.commitShapeNodeUpdate).toHaveBeenCalledWith({
      shapeNodeId: 'sn1',
      patch: {
        points: [
          { x: 30, y: 30 },
          { x: 60, y: 30 },
          { x: 60, y: 60 },
        ],
      },
    })
    expect(host.commitNodeMove).not.toHaveBeenCalled()
    expect(host.commitPathUpdate).not.toHaveBeenCalled()
    dispose()
  })

  it('skips locked shapeNode body drag', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost({
      canvas,
      nodes: [],
      shapeNodes: [{
        id: 'sn1',
        locked: true,
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
        ],
      }],
      selectedIds: ['sn1'],
      hitId: 'sn1',
      hitKind: 'shapeNode',
    })
    const dispose = new MoveNodeInteraction().attach(host)
    dragPastThreshold(canvas, { x: 20, y: 20 }, { x: 40, y: 30 })
    expect(host.commitShapeNodeUpdate).not.toHaveBeenCalled()
    dispose()
  })
})

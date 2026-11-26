import { describe, expect, it, vi } from 'vitest'
import { DeleteEdgeInteraction } from '../src/interaction/delete-edge.ts'
import type { InteractionHost } from '../src/interaction/types.ts'
import type { GraphEdge, GraphPath, GraphShapeNode } from '../src/protocol/types.ts'

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

function createHost(options: {
  view: FakeView
  edges: GraphEdge[]
  paths?: GraphPath[]
  shapeNodes?: GraphShapeNode[]
  selectedIds: string[]
}): InteractionHost & {
  commitEdgeRemove: ReturnType<typeof vi.fn>
  commitPathRemove: ReturnType<typeof vi.fn>
  commitShapeNodeRemove: ReturnType<typeof vi.fn>
  setSelection: ReturnType<typeof vi.fn>
} {
  let selectedIds = [...options.selectedIds]
  const commitEdgeRemove = vi.fn()
  const commitPathRemove = vi.fn()
  const commitShapeNodeRemove = vi.fn()
  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })

  return {
    getViewElement: () => options.view as unknown as HTMLDivElement,
    getHitElement: () => null,
    hitTestScreen: () => undefined,
    setSelection,
    setHover: vi.fn(),
    activateNode: vi.fn(),
    updateCamera: vi.fn(),
    viewport: { state: { zoom: 1, x: 0, y: 0 } } as InteractionHost['viewport'],
    getNode: () => undefined,
    getGroup: () => undefined,
    getNodes: () => [],
    getEdges: () => options.edges,
    getPaths: () => options.paths ?? [],
    getShapeNodes: () => options.shapeNodes ?? [],
    getGroups: () => [],
    getGroupBandBounds: () => ({ x: 0, y: 0, width: 100, height: 80 }),
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
    commitEdgeRemove,
    previewEdgeWaypoints: vi.fn(),
    previewPathPoints: vi.fn(),
    previewShapeNodePoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate: vi.fn(),
    commitPathUpdate: vi.fn(),
    commitPathRemove,
    commitShapeNodeCreate: vi.fn(),
    commitShapeNodeUpdate: vi.fn(),
    commitShapeNodeRemove,
    markGestureDragged: vi.fn(),
    wasGestureDragged: () => false,
    clearGestureDragged: vi.fn(),
    addOverlayChrome: vi.fn(() => () => {}),
    requestOverlayPaint: vi.fn(),
    requestPaint: vi.fn(),
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
    enterSubNetwork: vi.fn(),
    exitSubNetwork: vi.fn(),
    currentNetworkId: null,
  }
}

describe('DeleteEdgeInteraction', () => {
  it('Delete removes selected edges and clears selection', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }, { id: 'e2', from: 'b', to: 'c' }],
      selectedIds: ['e1', 'n1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    expect(view.tabIndex).toBe(0)

    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitEdgeRemove).toHaveBeenCalledWith(['e1'])
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })

  it('ignores Delete when no selected edge', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      selectedIds: ['a'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitEdgeRemove).not.toHaveBeenCalled()
    dispose()
  })

  it('Delete removes selected paths and clears selection', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [],
      paths: [{
        id: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }],
      selectedIds: ['p1', 'n1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitPathRemove).toHaveBeenCalledWith(['p1'])
    expect(host.commitEdgeRemove).not.toHaveBeenCalled()
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })

  it('Delete removes selected edges and paths together', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      paths: [{
        id: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }],
      selectedIds: ['e1', 'p1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Backspace' })
    expect(host.commitEdgeRemove).toHaveBeenCalledWith(['e1'])
    expect(host.commitPathRemove).toHaveBeenCalledWith(['p1'])
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })

  it('Delete removes selected shapeNodes and clears selection', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      }],
      selectedIds: ['sn1', 'n1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Delete' })
    expect(host.commitShapeNodeRemove).toHaveBeenCalledWith(['sn1'])
    expect(host.commitEdgeRemove).not.toHaveBeenCalled()
    expect(host.commitPathRemove).not.toHaveBeenCalled()
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })

  it('Delete removes edges, paths, and shapeNodes together', () => {
    const view = new FakeView()
    const host = createHost({
      view,
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      paths: [{
        id: 'p1',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }],
      shapeNodes: [{
        id: 'sn1',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      }],
      selectedIds: ['e1', 'p1', 'sn1'],
    })
    const dispose = new DeleteEdgeInteraction().attach(host)
    view.dispatch('keydown', { key: 'Backspace' })
    expect(host.commitEdgeRemove).toHaveBeenCalledWith(['e1'])
    expect(host.commitPathRemove).toHaveBeenCalledWith(['p1'])
    expect(host.commitShapeNodeRemove).toHaveBeenCalledWith(['sn1'])
    expect(host.setSelection).toHaveBeenCalledWith([])
    dispose()
  })
})

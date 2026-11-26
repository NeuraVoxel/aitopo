import { describe, expect, it, vi } from 'vitest'
import { SelectActivateInteraction } from '../src/interaction/select-activate.ts'
import type { InteractionHost } from '../src/interaction/types.ts'

/** Minimal EventTarget-like canvas for node-env SelectActivate tests. */
class FakeHitCanvas {
  private readonly listeners = new Map<string, Set<(event: PointerEvent) => void>>()

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

  dispatch(
    type: string,
    partial: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'> & {
      ctrlKey?: boolean
      metaKey?: boolean
      shiftKey?: boolean
      key?: string
      preventDefault?: () => void
    },
  ): void {
    const event = {
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {},
      ...partial,
    } as PointerEvent
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function createHost(
  canvas: FakeHitCanvas,
  hit: { id: string; kind: 'node' | 'edge' | 'group' | 'path' } = { id: 'n1', kind: 'node' },
  options: {
    node?: { id: string; networkId?: string }
    currentNetworkId?: string | null
  } = {},
): InteractionHost & {
  gestureDragged: boolean
  activateNode: ReturnType<typeof vi.fn>
  toggleGroupExpanded: ReturnType<typeof vi.fn>
  enterSubNetwork: ReturnType<typeof vi.fn>
  exitSubNetwork: ReturnType<typeof vi.fn>
  setSelection: ReturnType<typeof vi.fn>
  selectedIds: string[]
} {
  let gestureDragged = false
  let selectedIds: string[] = []
  const activateNode = vi.fn()
  const toggleGroupExpanded = vi.fn()
  const enterSubNetwork = vi.fn()
  const exitSubNetwork = vi.fn()
  const setSelection = vi.fn((ids: readonly string[]) => {
    selectedIds = [...ids]
  })
  const host = {
    get gestureDragged() {
      return gestureDragged
    },
    set gestureDragged(value: boolean) {
      gestureDragged = value
    },
    get selectedIds() {
      return selectedIds
    },
    set selectedIds(value: string[]) {
      selectedIds = value
    },
    activateNode,
    toggleGroupExpanded,
    enterSubNetwork,
    exitSubNetwork,
    get currentNetworkId() {
      return options.currentNetworkId ?? null
    },
    getHitElement: () => canvas as unknown as HTMLCanvasElement,
    getViewElement: () => canvas as unknown as HTMLElement,
    hitTestScreen: () => hit,
    setSelection,
    setHover: vi.fn(),
    updateCamera: vi.fn(),
    viewport: {} as InteractionHost['viewport'],
    getNode: (id: string) =>
      options.node?.id === id ? options.node : undefined,
    getGroup: () => undefined,
    getNodes: () =>
      options.node !== undefined
        ? [{ id: options.node.id, type: 'u', label: options.node.id }]
        : [
          { id: 'n1', type: 'u', label: 'n1' },
          { id: 'n2', type: 'u', label: 'n2' },
        ],
    getEdges: () => [{ id: 'e1', from: 'n1', to: 'n2' }],
    getPaths: () => [],
    getGroups: () => [{ id: 'g1', label: 'G', memberIds: [] }],
    getGroupBandBounds: () => ({ x: 0, y: 0, width: 100, height: 80 }),
    getEdgePathBounds: () => undefined,
    getPathBounds: () => undefined,
    getSelectedIds: () => selectedIds,
    hitTestGroupScreen: () => undefined,
    screenToWorld: () => ({ x: 0, y: 0 }),
    previewNodePosition: vi.fn(),
    previewNodeBounds: vi.fn(),
    previewGroupMove: vi.fn(),
    commitNodeMove: vi.fn(),
    commitGroupMove: vi.fn(),
    commitNodeResize: vi.fn(),
    commitEdgeCreate: vi.fn(),
    commitEdgeRemove: vi.fn(),
    previewEdgeWaypoints: vi.fn(),
    commitEdgeWaypoints: vi.fn(),
    commitPathCreate: vi.fn(),
    commitPathUpdate: vi.fn(),
    commitPathRemove: vi.fn(),
    markGestureDragged: () => {
      gestureDragged = true
    },
    wasGestureDragged: () => gestureDragged,
    clearGestureDragged: () => {
      gestureDragged = false
    },
    addOverlayChrome: vi.fn(() => () => {}),
    requestOverlayPaint: vi.fn(),
    requestPaint: vi.fn(),
    setDragPaintFilter: vi.fn(),
    emit: vi.fn(),
    apply: vi.fn(),
  }
  return host
}

describe('SelectActivate drag gate', () => {
  it('activates on pointerup when no drag gesture ran', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    expect(host.gestureDragged).toBe(false)
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 })

    expect(host.activateNode).toHaveBeenCalledWith('n1', 'click')
    dispose()
  })

  it('skips activate on pointerup after markGestureDragged', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    host.markGestureDragged()
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 40 })

    expect(host.activateNode).not.toHaveBeenCalled()
    dispose()
  })

  it('toggles group expanded on double-click without drag', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'g1', kind: 'group' })
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 })
    expect(host.toggleGroupExpanded).not.toHaveBeenCalled()

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 })
    expect(host.toggleGroupExpanded).toHaveBeenCalledWith('g1')
    expect(host.activateNode).not.toHaveBeenCalled()
    dispose()
  })

  it('skips group toggle after markGestureDragged', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'g1', kind: 'group' })
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 })
    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    host.markGestureDragged()
    canvas.dispatch('pointerup', { button: 0, clientX: 40, clientY: 40 })

    expect(host.toggleGroupExpanded).not.toHaveBeenCalled()
    dispose()
  })
})

describe('SelectActivate sub-network navigation', () => {
  function doubleClick(canvas: FakeHitCanvas, x = 10, y = 10): void {
    canvas.dispatch('pointerdown', { button: 0, clientX: x, clientY: y })
    canvas.dispatch('pointerup', { button: 0, clientX: x, clientY: y })
    canvas.dispatch('pointerdown', { button: 0, clientX: x, clientY: y })
    canvas.dispatch('pointerup', { button: 0, clientX: x, clientY: y })
  }

  it('enters the sub-network on node double-click instead of activating', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'team-a-node', kind: 'node' }, {
      node: { id: 'team-a-node', networkId: 'team-a' },
    })
    const dispose = new SelectActivateInteraction().attach(host)

    doubleClick(canvas)

    expect(host.enterSubNetwork).toHaveBeenCalledWith('team-a')
    // The first click of the pair still activates; the double never fires activation.
    expect(host.activateNode).toHaveBeenCalledWith('team-a-node', 'click')
    expect(host.activateNode).not.toHaveBeenCalledWith('team-a-node', 'dblclick')
    dispose()
  })

  it('keeps double-click activation for nodes without networkId', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'plain', kind: 'node' }, {
      node: { id: 'plain' },
    })
    const dispose = new SelectActivateInteraction().attach(host)

    doubleClick(canvas)

    expect(host.activateNode).toHaveBeenCalledWith('plain', 'dblclick')
    expect(host.enterSubNetwork).not.toHaveBeenCalled()
    dispose()
  })

  it('exits the sub-network on empty-space double-click', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'outside', kind: 'node' }, {
      node: { id: 'outside', networkId: 'team-a' },
      currentNetworkId: 'team-a',
    })
    // Empty space: hit misses.
    const hitHost = Object.assign(host, {
      hitTestScreen: () => undefined,
    })
    const dispose = new SelectActivateInteraction().attach(hitHost)

    doubleClick(canvas)

    expect(host.exitSubNetwork).toHaveBeenCalled()
    expect(host.enterSubNetwork).not.toHaveBeenCalled()
    dispose()
  })

  it('ignores empty-space double-click at the root network', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'n1', kind: 'node' })
    const hitHost = Object.assign(host, {
      hitTestScreen: () => undefined,
    })
    const dispose = new SelectActivateInteraction().attach(hitHost)

    doubleClick(canvas)

    expect(host.exitSubNetwork).not.toHaveBeenCalled()
    expect(host.activateNode).not.toHaveBeenCalled()
    dispose()
  })
})

describe('SelectActivate multi-select', () => {
  it('Ctrl+click toggles an id in the selection', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'n2', kind: 'node' })
    host.setSelection(['n1'])
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, ctrlKey: true })
    expect(host.setSelection).toHaveBeenLastCalledWith(['n1', 'n2'])

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, ctrlKey: true })
    expect(host.setSelection).toHaveBeenLastCalledWith(['n1'])
    dispose()
  })

  it('plain click still replaces selection when the hit was not selected', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'n2', kind: 'node' })
    host.setSelection(['n1'])
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    expect(host.setSelection).toHaveBeenLastCalledWith(['n2'])
    dispose()
  })

  it('plain click on an already-selected id keeps the multi-select', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'n1', kind: 'node' })
    host.setSelection(['n1', 'n2'])
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    expect(host.setSelection).toHaveBeenCalledTimes(1) // setup only
    expect(host.getSelectedIds()).toEqual(['n1', 'n2'])
    dispose()
  })

  it('Ctrl+A selects all nodes, groups, edges, and paths', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)

    canvas.dispatch('keydown', { button: 0, clientX: 0, clientY: 0, ctrlKey: true, key: 'a' })
    expect(host.setSelection).toHaveBeenLastCalledWith(['n1', 'n2', 'g1', 'e1'])
    dispose()
  })

  it('does not clear selection on Ctrl+empty pointerdown', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas, { id: 'n1', kind: 'node' })
    host.setSelection(['n1'])
    const hitHost = Object.assign(host, {
      hitTestScreen: () => undefined,
    })
    const dispose = new SelectActivateInteraction().attach(hitHost)

    canvas.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10, ctrlKey: true })
    expect(host.setSelection).toHaveBeenCalledTimes(1) // only the setup call
    dispose()
  })

  it('prevents the Ctrl+click context menu', () => {
    const canvas = new FakeHitCanvas()
    const host = createHost(canvas)
    const dispose = new SelectActivateInteraction().attach(host)
    const preventDefault = vi.fn()

    canvas.dispatch('contextmenu', {
      button: 0,
      clientX: 10,
      clientY: 10,
      ctrlKey: true,
      preventDefault,
    })
    expect(preventDefault).toHaveBeenCalled()

    const plain = vi.fn()
    canvas.dispatch('contextmenu', {
      button: 2,
      clientX: 10,
      clientY: 10,
      ctrlKey: false,
      preventDefault: plain,
    })
    expect(plain).not.toHaveBeenCalled()
    dispose()
  })
})

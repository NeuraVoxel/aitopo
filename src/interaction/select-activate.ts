/**
 * Click / double-click selection and activation; Ctrl/Cmd multi-select; Ctrl/Cmd+A.
 */

import type { Interaction, InteractionHost } from './types.ts'

/** Select on pointer down; emit click / dblclick activation, navigate sub-networks on dblclick. */
export class SelectActivateInteraction implements Interaction {
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let lastClickAt = 0
    let lastClickId: string | undefined
    let lastEmptyClickAt = 0
    let pendingNodeId: string | undefined
    let pendingGroupId: string | undefined

    const isDouble = (now: number, id: string | undefined, previousId: string | undefined): boolean =>
      previousId !== undefined && id === previousId && now - lastClickAt < 350

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      // macOS maps Ctrl+click to a context menu; keep the multi-select gesture.
      if (event.ctrlKey) event.preventDefault()
      network.clearGestureDragged()
      pendingNodeId = undefined
      pendingGroupId = undefined
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined) {
        // Shift/Ctrl empty starts marquee — do not clear before that gesture runs.
        if (!(event.shiftKey || event.ctrlKey || event.metaKey)) {
          network.setSelection([])
        }
        network.setHover(undefined)
        return
      }
      if (event.ctrlKey || event.metaKey) {
        const next = [...network.getSelectedIds()]
        const index = next.indexOf(hit.id)
        if (index >= 0) next.splice(index, 1)
        else next.push(hit.id)
        network.setSelection(next)
      } else if (!network.getSelectedIds().includes(hit.id)) {
        // Already-selected hit keeps the multi-select so MoveNode can drag all.
        network.setSelection([hit.id])
      }
      if (hit.kind === 'node') pendingNodeId = hit.id
      else if (hit.kind === 'group') pendingGroupId = hit.id
    }

    /** Suppress the macOS Ctrl+click context menu (multi-select / Ctrl-marquee). */
    const onContextMenu = (event: Event): void => {
      const mouse = event as MouseEvent
      if (mouse.ctrlKey) event.preventDefault()
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const nodeId = pendingNodeId
      const groupId = pendingGroupId
      pendingNodeId = undefined
      pendingGroupId = undefined
      if (network.wasGestureDragged()) return

      const now = performance.now()

      if (groupId !== undefined) {
        const double = isDouble(now, groupId, lastClickId)
        lastClickAt = now
        lastClickId = groupId
        lastEmptyClickAt = 0
        if (double) network.toggleGroupExpanded(groupId)
        return
      }

      if (nodeId !== undefined) {
        const double = isDouble(now, nodeId, lastClickId)
        lastClickAt = now
        lastClickId = nodeId
        lastEmptyClickAt = 0
        const networkId = network.getNode(nodeId)?.networkId
        if (double && networkId !== undefined) {
          // Sub-network navigation, not activation.
          network.enterSubNetwork(networkId)
          return
        }
        network.activateNode(nodeId, double ? 'dblclick' : 'click')
        return
      }

      // Empty space: double-click exits the active sub-network.
      const doubleEmpty = lastEmptyClickAt !== 0 && now - lastEmptyClickAt < 350
      lastClickId = undefined
      lastEmptyClickAt = doubleEmpty ? 0 : now
      if (doubleEmpty && network.currentNetworkId !== null) {
        network.exitSubNetwork()
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      network.setHover(hit?.id)
    }

    const onPointerLeave = (): void => {
      network.setHover(undefined)
    }

    const onKeyDown = (event: Event): void => {
      const keyEvent = event as KeyboardEvent
      if (!(keyEvent.ctrlKey || keyEvent.metaKey)) return
      if (keyEvent.key !== 'a' && keyEvent.key !== 'A') return
      const el = keyEvent.target
      if (el !== null && typeof el === 'object' && 'tagName' in el) {
        const tag = String((el as { tagName: string }).tagName)
        const editable = 'isContentEditable' in el
          && (el as { isContentEditable: boolean }).isContentEditable === true
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return
      }
      keyEvent.preventDefault()
      const ids = [
        ...network.getNodes().map(n => n.id),
        ...network.getGroups().map(g => g.id),
        ...network.getEdges().map(e => e.id),
        ...network.getPaths().map(p => p.id),
        ...network.getShapeNodes().map(s => s.id),
      ]
      network.setSelection(ids)
    }

    const view = network.getViewElement()
    const keyTarget: EventTarget = view
      ?? (typeof document !== 'undefined' ? document : new EventTarget())

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('contextmenu', onContextMenu)
    keyTarget.addEventListener('keydown', onKeyDown)
    if (view !== null && view.tabIndex < 0) {
      view.tabIndex = 0
    }

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('contextmenu', onContextMenu)
      keyTarget.removeEventListener('keydown', onKeyDown)
    }
  }
}

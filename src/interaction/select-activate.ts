/**
 * Click / double-click selection and activation.
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
      network.clearGestureDragged()
      pendingNodeId = undefined
      pendingGroupId = undefined
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined) {
        network.setSelection([])
        network.setHover(undefined)
        return
      }
      network.setSelection([hit.id])
      if (hit.kind === 'node') pendingNodeId = hit.id
      else if (hit.kind === 'group') pendingGroupId = hit.id
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

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }
}

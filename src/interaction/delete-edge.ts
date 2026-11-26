/**
 * Delete/Backspace removes selected edges, freestanding paths, and shape nodes.
 */

import type { Interaction, InteractionHost } from './types.ts'

/**
 * Keyboard delete for selected edges, paths, and shape nodes.
 * Nodes/groups are left to the host. Class name kept for call-site compatibility.
 * Ignores events when the target is an editable field.
 */
export class DeleteEdgeInteraction implements Interaction {
  /**
   * Attach keydown on the view (or document when view is null until mount — no-op).
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const view = network.getViewElement()
    const target: EventTarget = view ?? (typeof document !== 'undefined' ? document : new EventTarget())

    const onKeyDown = (event: Event): void => {
      const keyEvent = event as KeyboardEvent
      if (keyEvent.key !== 'Delete' && keyEvent.key !== 'Backspace') return
      const el = keyEvent.target
      if (el !== null && typeof el === 'object' && 'tagName' in el) {
        const tag = String((el as { tagName: string }).tagName)
        const editable = 'isContentEditable' in el
          && (el as { isContentEditable: boolean }).isContentEditable === true
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return
      }
      const selected = network.getSelectedIds()
      if (selected.length === 0) return
      const edgeIds = new Set(network.getEdges().map(e => e.id))
      const pathIds = new Set(network.getPaths().map(p => p.id))
      const shapeNodeIds = new Set(network.getShapeNodes().map(s => s.id))
      const edgesToRemove = selected.filter(id => edgeIds.has(id))
      const pathsToRemove = selected.filter(id => pathIds.has(id))
      const shapeNodesToRemove = selected.filter(id => shapeNodeIds.has(id))
      if (
        edgesToRemove.length === 0
        && pathsToRemove.length === 0
        && shapeNodesToRemove.length === 0
      ) {
        return
      }
      keyEvent.preventDefault()
      if (edgesToRemove.length > 0) network.commitEdgeRemove(edgesToRemove)
      if (pathsToRemove.length > 0) network.commitPathRemove(pathsToRemove)
      if (shapeNodesToRemove.length > 0) {
        network.commitShapeNodeRemove(shapeNodesToRemove)
      }
      network.setSelection([])
    }

    target.addEventListener('keydown', onKeyDown)
    // Focusable stage so Delete works without focusing an input.
    if (view !== null && view.tabIndex < 0) {
      view.tabIndex = 0
    }

    return () => {
      target.removeEventListener('keydown', onKeyDown)
    }
  }
}

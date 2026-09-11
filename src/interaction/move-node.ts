/**
 * Drag-move selected unlocked nodes with optional group membership on drop.
 */

import { groupBounds, nodeBounds } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const DRAG_THRESHOLD_PX = 4

export interface MoveNodeInteractionOptions {
  /**
   * When true, during an active move only movers and incident edges are painted
   * (groups and other nodes hidden). Default false: paint the full scene.
   * Ignored when `lazyMove` is true (ghosts need the full scene).
   */
  readonly hideOthersWhileDragging?: boolean
  /**
   * When true, do not call `previewNodePosition` during drag; paint ghost
   * outlines on the overlay and commit on pointer-up. Default false (live move).
   */
  readonly lazyMove?: boolean
}

/** Live- or lazy-move nodes; skip locked; reparent from group under pointer on commit. */
export class MoveNodeInteraction implements Interaction {
  private readonly hideOthersWhileDragging: boolean
  private readonly lazyMove: boolean

  /**
   * @param options - optional paint filter / lazy move.
   */
  constructor(options: MoveNodeInteractionOptions = {}) {
    this.hideOthersWhileDragging = options.hideOthersWhileDragging === true
    this.lazyMove = options.lazyMove === true
  }

  /**
   * Attach pointer listeners for node move.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active = false
    let dragged = false
    let startClientX = 0
    let startClientY = 0
    let movers: { id: string; fromX: number; fromY: number }[] = []
    /** Pointer id held via setPointerCapture; null when none. */
    let capturedPointerId: number | null = null
    let dx = 0
    let dy = 0
    let dropTargetGroupId: string | undefined
    let removeChrome: (() => void) | undefined

    const reset = (): void => {
      active = false
      dragged = false
      movers = []
      capturedPointerId = null
      dx = 0
      dy = 0
      dropTargetGroupId = undefined
    }

    const releaseCapture = (): void => {
      if (capturedPointerId === null) return
      try {
        canvas.releasePointerCapture(capturedPointerId)
      } catch {
        // Pointer already released.
      }
      capturedPointerId = null
    }

    const lazyMove = this.lazyMove
    const hideOthers = this.hideOthersWhileDragging

    const clearPaintFilter = (): void => {
      if (hideOthers && !lazyMove) {
        network.setDragPaintFilter(undefined)
      }
    }

    const clearChrome = (): void => {
      removeChrome?.()
      removeChrome = undefined
    }

    const ensureChrome = (): void => {
      if (removeChrome !== undefined) {
        network.requestOverlayPaint()
        return
      }
      removeChrome = network.addOverlayChrome({
        paint(renderer) {
          if (dropTargetGroupId !== undefined) {
            const group = network.getGroups().find(g => g.id === dropTargetGroupId)
            if (group !== undefined) {
              renderer.drawDropTargetHighlight(groupBounds(group))
            }
          }
          if (!lazyMove || !dragged) return
          for (const mover of movers) {
            const node = network.getNode(mover.id)
            if (node === undefined) continue
            const bounds = nodeBounds({
              ...node,
              x: mover.fromX + dx,
              y: mover.fromY + dy,
            })
            renderer.drawLazyMoveGhost(bounds)
          }
        },
      })
    }

    /** Revert live previews to drag-start positions, release capture, clear state. */
    const abortWithoutCommit = (): void => {
      if (active && dragged && !lazyMove) {
        for (const mover of movers) {
          network.previewNodePosition(mover.id, mover.fromX, mover.fromY)
        }
      }
      clearPaintFilter()
      clearChrome()
      releaseCapture()
      reset()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      // Alt+drag is CreateEdge; leave that gesture alone.
      if (event.altKey) return
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (hit === undefined || hit.kind !== 'node') return
      if (network.getNode(hit.id) === undefined) return

      let selectedIds = network.getSelectedIds()
      if (!selectedIds.includes(hit.id)) {
        network.setSelection([hit.id])
        selectedIds = [hit.id]
      }

      const nextMovers: { id: string; fromX: number; fromY: number }[] = []
      for (const id of selectedIds) {
        const node = network.getNode(id)
        if (node === undefined || node.locked === true) continue
        nextMovers.push({
          id,
          fromX: node.x ?? 0,
          fromY: node.y ?? 0,
        })
      }
      if (nextMovers.length === 0) return

      active = true
      dragged = false
      startClientX = event.clientX
      startClientY = event.clientY
      movers = nextMovers
      dx = 0
      dy = 0
      dropTargetGroupId = undefined
    }

    const previewAt = (clientX: number, clientY: number): void => {
      const zoom = network.viewport.state.zoom
      dx = (clientX - startClientX) / zoom
      dy = (clientY - startClientY) / zoom
      if (!lazyMove) {
        for (const mover of movers) {
          network.previewNodePosition(mover.id, mover.fromX + dx, mover.fromY + dy)
        }
      }
    }

    const updateDropTarget = (clientX: number, clientY: number): void => {
      const rect = canvas.getBoundingClientRect()
      dropTargetGroupId = network.hitTestGroupScreen(
        clientX - rect.left,
        clientY - rect.top,
      )
      ensureChrome()
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!active) return
      if (!dragged) {
        const dist = Math.hypot(event.clientX - startClientX, event.clientY - startClientY)
        if (dist < DRAG_THRESHOLD_PX) return
        dragged = true
        network.markGestureDragged()
        if (hideOthers && !lazyMove) {
          network.setDragPaintFilter(movers.map(m => m.id))
        }
        try {
          canvas.setPointerCapture(event.pointerId)
          capturedPointerId = event.pointerId
        } catch {
          // Capture unsupported or already held.
        }
      }
      previewAt(event.clientX, event.clientY)
      updateDropTarget(event.clientX, event.clientY)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!active) return
      if (dragged) {
        const zoom = network.viewport.state.zoom
        const finalDx = (event.clientX - startClientX) / zoom
        const finalDy = (event.clientY - startClientY) / zoom
        const rect = canvas.getBoundingClientRect()
        const groupHit = network.hitTestGroupScreen(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
        for (const mover of movers) {
          network.commitNodeMove({
            nodeId: mover.id,
            from: { x: mover.fromX, y: mover.fromY },
            to: { x: mover.fromX + finalDx, y: mover.fromY + finalDy },
            toGroupId: groupHit,
          })
        }
        clearPaintFilter()
        clearChrome()
        releaseCapture()
      }
      reset()
    }

    const onPointerCancel = (): void => {
      abortWithoutCommit()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    return () => {
      abortWithoutCommit()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }
}

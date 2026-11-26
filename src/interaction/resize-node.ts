/**
 * Corner-handle resize for selected unlocked nodes.
 */

import { anglePivot, rotatePointAround } from '../geom.ts'
import { nodeBounds } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const MIN_SIZE = 24
const HANDLE_SCREEN_PX = 8
const HIT_PAD_SCREEN_PX = 4

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface HandleHit {
  readonly nodeId: string
  readonly corner: Corner
  readonly from: { x: number; y: number; w: number; h: number }
}

/**
 * Paint resize handles on selected unlocked nodes; drag a corner to resize.
 * Attach **before** MoveNodeInteraction so capture-phase handle hits win.
 */
export class ResizeNodeInteraction implements Interaction {
  /**
   * Attach pointer listeners for node resize.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active: HandleHit | undefined
    let startClientX = 0
    let startClientY = 0
    let capturedPointerId: number | null = null

    const handleSizeWorld = (): number => HANDLE_SCREEN_PX / network.viewport.state.zoom
    const hitPadWorld = (): number => (HANDLE_SCREEN_PX / 2 + HIT_PAD_SCREEN_PX) / network.viewport.state.zoom

    const cornersOf = (box: { x: number; y: number; w: number; h: number }): Record<Corner, { x: number; y: number }> => ({
      nw: { x: box.x, y: box.y },
      ne: { x: box.x + box.w, y: box.y },
      sw: { x: box.x, y: box.y + box.h },
      se: { x: box.x + box.w, y: box.y + box.h },
    })

    const hitHandle = (worldX: number, worldY: number): HandleHit | undefined => {
      const pad = hitPadWorld()
      for (const id of network.getSelectedIds()) {
        const node = network.getNode(id)
        if (node === undefined || node.locked === true) continue
        const bounds = nodeBounds(node)
        const box = { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height }
        const angle = node.angle ?? 0
        const pivot = anglePivot(bounds, node.angleAnchor)
        const corners = cornersOf(box)
        for (const corner of Object.keys(corners) as Corner[]) {
          const raw = corners[corner]
          const c = rotatePointAround(raw, pivot, angle)
          if (Math.abs(worldX - c.x) <= pad && Math.abs(worldY - c.y) <= pad) {
            return { nodeId: id, corner, from: box }
          }
        }
      }
      return undefined
    }

    const applyCornerDelta = (
      from: { x: number; y: number; w: number; h: number },
      corner: Corner,
      dx: number,
      dy: number,
    ): { x: number; y: number; w: number; h: number } => {
      let { x, y, w, h } = from
      switch (corner) {
        case 'nw':
          x += dx
          y += dy
          w -= dx
          h -= dy
          break
        case 'ne':
          y += dy
          w += dx
          h -= dy
          break
        case 'sw':
          x += dx
          w -= dx
          h += dy
          break
        case 'se':
          w += dx
          h += dy
          break
        default: {
          const _exhaustive: never = corner
          return _exhaustive
        }
      }
      if (w < MIN_SIZE) {
        if (corner === 'nw' || corner === 'sw') x = from.x + from.w - MIN_SIZE
        w = MIN_SIZE
      }
      if (h < MIN_SIZE) {
        if (corner === 'nw' || corner === 'ne') y = from.y + from.h - MIN_SIZE
        h = MIN_SIZE
      }
      return { x, y, w, h }
    }

    const removeChrome = network.addOverlayChrome({
      paint(renderer) {
        const size = handleSizeWorld()
        for (const id of network.getSelectedIds()) {
          const node = network.getNode(id)
          if (node === undefined || node.locked === true) continue
          const bounds = nodeBounds(node)
          const box = { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height }
          const angle = node.angle ?? 0
          const pivot = anglePivot(bounds, node.angleAnchor)
          for (const point of Object.values(cornersOf(box))) {
            renderer.drawResizeHandle(rotatePointAround(point, pivot, angle), size)
          }
        }
      },
    })

    const releaseCapture = (): void => {
      if (capturedPointerId === null) return
      try {
        canvas.releasePointerCapture(capturedPointerId)
      } catch {
        // Pointer already released.
      }
      capturedPointerId = null
    }

    const abort = (): void => {
      if (active !== undefined) {
        network.previewNodeBounds(active.nodeId, active.from)
      }
      releaseCapture()
      active = undefined
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || event.altKey) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      const hit = hitHandle(world.x, world.y)
      if (hit === undefined) return
      event.stopPropagation()
      active = hit
      startClientX = event.clientX
      startClientY = event.clientY
      network.markGestureDragged()
      try {
        canvas.setPointerCapture(event.pointerId)
        capturedPointerId = event.pointerId
      } catch {
        // Capture unsupported or already held.
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (active === undefined) return
      const zoom = network.viewport.state.zoom
      const dx = (event.clientX - startClientX) / zoom
      const dy = (event.clientY - startClientY) / zoom
      const next = applyCornerDelta(active.from, active.corner, dx, dy)
      network.previewNodeBounds(active.nodeId, next)
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (active === undefined) return
      const zoom = network.viewport.state.zoom
      const dx = (event.clientX - startClientX) / zoom
      const dy = (event.clientY - startClientY) / zoom
      const to = applyCornerDelta(active.from, active.corner, dx, dy)
      const from = active.from
      const nodeId = active.nodeId
      releaseCapture()
      active = undefined
      network.commitNodeResize({ nodeId, from, to })
    }

    const onPointerCancel = (): void => {
      abort()
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)

    return () => {
      abort()
      removeChrome()
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }
}

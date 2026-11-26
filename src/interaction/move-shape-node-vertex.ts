/**
 * Drag control-point handles on selected shape nodes.
 */

import type { Point } from '../geom.ts'
import type { Interaction, InteractionHost } from './types.ts'

const HANDLE_SIZE = 10
const HIT_PAD = 8

interface VertexDrag {
  readonly shapeNodeId: string
  readonly index: number
  readonly closed: boolean
  points: Point[]
}

/**
 * When a shape node is selected, pointer on a control handle drags that vertex.
 * Pack **before** MoveNodeInteraction so capture-phase handle hits win over body drag.
 * Ignores locked shape nodes. Network already paints selection handles; chrome here
 * shows the in-flight vertex until commit. Closed bodies preview the closing edge.
 */
export class MoveShapeNodeVertexInteraction implements Interaction {
  /**
   * Attach pointer listeners for shape-node vertex drag.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let drag: VertexDrag | undefined
    let removeChrome: (() => void) | undefined

    const handleSize = (): number => HANDLE_SIZE / network.viewport.state.zoom

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
          if (drag === undefined) return
          const size = handleSize()
          for (let i = 0; i < drag.points.length - 1; i += 1) {
            renderer.drawEdgeRubberBand(drag.points[i]!, drag.points[i + 1]!)
          }
          if (drag.closed && drag.points.length >= 2) {
            const last = drag.points[drag.points.length - 1]!
            const first = drag.points[0]!
            renderer.drawEdgeRubberBand(last, first)
          }
          for (const point of drag.points) {
            renderer.drawResizeHandle(point, size)
          }
        },
      })
    }

    const hitHandle = (
      shapeNodeId: string,
      world: Point,
    ): { index: number; points: Point[]; closed: boolean } | undefined => {
      const shapeNode = network.getShapeNodes().find(s => s.id === shapeNodeId)
      if (shapeNode === undefined || shapeNode.locked === true) return undefined
      const pad = HIT_PAD / network.viewport.state.zoom
      const half = handleSize() / 2
      for (let i = shapeNode.points.length - 1; i >= 0; i -= 1) {
        const p = shapeNode.points[i]!
        if (
          Math.abs(world.x - p.x) <= pad + half
          && Math.abs(world.y - p.y) <= pad + half
        ) {
          return {
            index: i,
            points: shapeNode.points.map(pt => ({ x: pt.x, y: pt.y })),
            closed: shapeNode.closed !== false,
          }
        }
      }
      return undefined
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      for (const id of network.getSelectedIds()) {
        const hit = hitHandle(id, world)
        if (hit === undefined) continue
        drag = {
          shapeNodeId: id,
          index: hit.index,
          closed: hit.closed,
          points: hit.points.map(p => ({ x: p.x, y: p.y })),
        }
        network.clearGestureDragged()
        network.markGestureDragged()
        ensureChrome()
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // Capture unsupported or already held.
        }
        event.stopPropagation()
        return
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (drag === undefined) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      const next = drag.points.map(p => ({ x: p.x, y: p.y }))
      next[drag.index] = { x: world.x, y: world.y }
      drag.points = next
      network.previewShapeNodePoints(drag.shapeNodeId, next)
      network.markGestureDragged()
      ensureChrome()
    }

    const finish = (event: PointerEvent): void => {
      if (drag === undefined) return
      const finished = drag
      drag = undefined
      clearChrome()
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already be released.
      }
      network.commitShapeNodeUpdate({
        shapeNodeId: finished.shapeNodeId,
        patch: { points: finished.points },
      })
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)

    return () => {
      clearChrome()
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
    }
  }
}

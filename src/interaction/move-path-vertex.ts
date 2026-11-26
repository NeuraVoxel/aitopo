/**
 * Drag control-point handles on selected freestanding paths.
 */

import type { Point } from '../geom.ts'
import type { Interaction, InteractionHost } from './types.ts'

const HANDLE_SIZE = 10
const HIT_PAD = 8

interface VertexDrag {
  readonly pathId: string
  readonly index: number
  points: Point[]
}

/**
 * When a path is selected, pointer on a control handle drags that vertex.
 * Pack **before** MoveNodeInteraction so capture-phase handle hits win over body drag.
 * Ignores locked paths. Network already paints selection handles; chrome here shows
 * the in-flight vertex until commit.
 */
export class MovePathVertexInteraction implements Interaction {
  /**
   * Attach pointer listeners for path vertex drag.
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
          for (const point of drag.points) {
            renderer.drawResizeHandle(point, size)
          }
        },
      })
    }

    const hitHandle = (
      pathId: string,
      world: Point,
    ): { index: number; points: Point[] } | undefined => {
      const path = network.getPaths().find(p => p.id === pathId)
      if (path === undefined || path.locked === true) return undefined
      const pad = HIT_PAD / network.viewport.state.zoom
      const half = handleSize() / 2
      for (let i = path.points.length - 1; i >= 0; i -= 1) {
        const p = path.points[i]!
        if (
          Math.abs(world.x - p.x) <= pad + half
          && Math.abs(world.y - p.y) <= pad + half
        ) {
          return {
            index: i,
            points: path.points.map(pt => ({ x: pt.x, y: pt.y })),
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
          pathId: id,
          index: hit.index,
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
      network.previewPathPoints(drag.pathId, next)
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
      network.commitPathUpdate({
        pathId: finished.pathId,
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

/**
 * Drag control-point handles on selected freestanding paths.
 */

import {
  anglePivot,
  inverseRotatePointAround,
  rotatePointAround,
  type Point,
  type Rect,
} from '../geom.ts'
import { unionPoint } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const HANDLE_SIZE = 10
const HIT_PAD = 8

interface VertexDrag {
  readonly pathId: string
  readonly index: number
  points: Point[]
}

/**
 * When a path is selected in Edit, paint control handles and drag a vertex.
 * Pack **before** MoveNodeInteraction so capture-phase handle hits win over body drag.
 * Ignores locked paths. Selection highlight alone (Observe) does not show handles.
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

    const handleSize = (): number => HANDLE_SIZE / network.viewport.state.zoom

    const pointsBox = (points: readonly Point[]): Rect | undefined => {
      let box: Rect | undefined
      for (const point of points) box = unionPoint(box, point)
      return box
    }

    const worldHandles = (
      points: readonly Point[],
      angle: number,
      anchor: { readonly u: number; readonly v: number } | undefined,
    ): Point[] => {
      if (angle === 0 || points.length === 0) {
        return points.map(p => ({ x: p.x, y: p.y }))
      }
      const box = pointsBox(points)
      if (box === undefined) return points.map(p => ({ x: p.x, y: p.y }))
      const pivot = anglePivot(box, anchor)
      return points.map(p => rotatePointAround(p, pivot, angle))
    }

    const removeChrome = network.addOverlayChrome({
      paint(renderer) {
        const size = handleSize()
        if (drag !== undefined) {
          for (let i = 0; i < drag.points.length - 1; i += 1) {
            renderer.drawEdgeRubberBand(drag.points[i]!, drag.points[i + 1]!)
          }
          for (const point of drag.points) {
            renderer.drawResizeHandle(point, size)
          }
          return
        }
        for (const id of network.getSelectedIds()) {
          const path = network.getPaths().find(p => p.id === id)
          if (path === undefined || path.locked === true) continue
          for (const point of worldHandles(path.points, path.angle ?? 0, path.angleAnchor)) {
            renderer.drawResizeHandle(point, size)
          }
        }
      },
    })

    const hitHandle = (
      pathId: string,
      world: Point,
    ): { index: number; points: Point[] } | undefined => {
      const path = network.getPaths().find(p => p.id === pathId)
      if (path === undefined || path.locked === true) return undefined
      const pad = HIT_PAD / network.viewport.state.zoom
      const half = handleSize() / 2
      const angle = path.angle ?? 0
      const box = pointsBox(path.points)
      const pivot = box === undefined ? undefined : anglePivot(box, path.angleAnchor)
      const local = angle === 0 || pivot === undefined
        ? world
        : inverseRotatePointAround(world, pivot, angle)
      for (let i = path.points.length - 1; i >= 0; i -= 1) {
        const p = path.points[i]!
        if (
          Math.abs(local.x - p.x) <= pad + half
          && Math.abs(local.y - p.y) <= pad + half
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
        network.requestOverlayPaint()
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
      const path = network.getPaths().find(p => p.id === drag!.pathId)
      const angle = path?.angle ?? 0
      const box = pointsBox(drag.points)
      const pivot = box === undefined ? undefined : anglePivot(box, path?.angleAnchor)
      const local = angle === 0 || pivot === undefined
        ? world
        : inverseRotatePointAround(world, pivot, angle)
      const next = drag.points.map(p => ({ x: p.x, y: p.y }))
      next[drag.index] = { x: local.x, y: local.y }
      drag.points = next
      network.previewPathPoints(drag.pathId, next)
      network.markGestureDragged()
      network.requestOverlayPaint()
    }

    const finish = (event: PointerEvent): void => {
      if (drag === undefined) return
      const finished = drag
      drag = undefined
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already be released.
      }
      network.commitPathUpdate({
        pathId: finished.pathId,
        patch: { points: finished.points },
      })
      network.requestOverlayPaint()
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)

    return () => {
      removeChrome()
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
    }
  }
}

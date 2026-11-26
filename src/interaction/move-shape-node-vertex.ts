/**
 * Drag control-point handles on selected shape nodes.
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
  readonly shapeNodeId: string
  readonly index: number
  readonly closed: boolean
  points: Point[]
}

/**
 * When a shape node is selected in Edit, paint control handles and drag a vertex.
 * Pack **before** MoveNodeInteraction so capture-phase handle hits win over body drag.
 * Ignores locked shape nodes. Selection highlight alone (Observe) does not show handles.
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
          if (drag.closed && drag.points.length >= 2) {
            const last = drag.points[drag.points.length - 1]!
            const first = drag.points[0]!
            renderer.drawEdgeRubberBand(last, first)
          }
          for (const point of drag.points) {
            renderer.drawResizeHandle(point, size)
          }
          return
        }
        for (const id of network.getSelectedIds()) {
          const shapeNode = network.getShapeNodes().find(s => s.id === id)
          if (
            shapeNode === undefined
            || shapeNode.locked === true
            || !network.isLayerEditable(id)
          ) continue
          for (const point of worldHandles(
            shapeNode.points,
            shapeNode.angle ?? 0,
            shapeNode.angleAnchor,
          )) {
            renderer.drawResizeHandle(point, size)
          }
        }
      },
    })

    const hitHandle = (
      shapeNodeId: string,
      world: Point,
    ): { index: number; points: Point[]; closed: boolean } | undefined => {
      const shapeNode = network.getShapeNodes().find(s => s.id === shapeNodeId)
      if (
        shapeNode === undefined
        || shapeNode.locked === true
        || !network.isLayerEditable(shapeNodeId)
      ) {
        return undefined
      }
      const pad = HIT_PAD / network.viewport.state.zoom
      const half = handleSize() / 2
      const angle = shapeNode.angle ?? 0
      const box = pointsBox(shapeNode.points)
      const pivot = box === undefined ? undefined : anglePivot(box, shapeNode.angleAnchor)
      const local = angle === 0 || pivot === undefined
        ? world
        : inverseRotatePointAround(world, pivot, angle)
      for (let i = shapeNode.points.length - 1; i >= 0; i -= 1) {
        const p = shapeNode.points[i]!
        if (
          Math.abs(local.x - p.x) <= pad + half
          && Math.abs(local.y - p.y) <= pad + half
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
      const shapeNode = network.getShapeNodes().find(s => s.id === drag!.shapeNodeId)
      const angle = shapeNode?.angle ?? 0
      const box = pointsBox(drag.points)
      const pivot = box === undefined ? undefined : anglePivot(box, shapeNode?.angleAnchor)
      const local = angle === 0 || pivot === undefined
        ? world
        : inverseRotatePointAround(world, pivot, angle)
      const next = drag.points.map(p => ({ x: p.x, y: p.y }))
      next[drag.index] = { x: local.x, y: local.y }
      drag.points = next
      network.previewShapeNodePoints(drag.shapeNodeId, next)
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
      network.commitShapeNodeUpdate({
        shapeNodeId: finished.shapeNodeId,
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

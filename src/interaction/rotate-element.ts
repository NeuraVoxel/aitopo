/**
 * Rotate handle for selected unlocked Node / Group / Path / ShapeNode.
 * twaver EditInteraction rotate idea (clean-room): handle above original top-mid,
 * dragged to set `angle` about `angleAnchor` pivot.
 */

import {
  anglePivot,
  normalizeAngleDegrees,
  rotatePointAround,
  type Point,
  type Rect,
} from '../geom.ts'
import { nodeBounds } from '../ui/bounds.ts'
import type { GraphAngleAnchor } from '../protocol/types.ts'
import type { Interaction, InteractionHost } from './types.ts'

const HANDLE_SCREEN_PX = 8
const HIT_PAD_SCREEN_PX = 6
/** World offset above original top edge before rotation (twaver rotate point offset idea). */
const HANDLE_OFFSET_WORLD = 18

type RotatableKind = 'node' | 'group' | 'path' | 'shapeNode'

interface RotateHit {
  readonly kind: RotatableKind
  readonly id: string
  readonly fromAngle: number
  readonly pivot: Point
  readonly originalBounds: Rect
}

/**
 * Paint a rotate handle on selected unlocked rotatable elements; drag to set angle.
 * Attach in Edit pack (capture-phase) so handle hits win over MoveNode.
 */
export class RotateElementInteraction implements Interaction {
  /**
   * Attach pointer listeners for element rotate.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active: RotateHit | undefined
    let capturedPointerId: number | null = null

    const handleSizeWorld = (): number => HANDLE_SCREEN_PX / network.viewport.state.zoom
    const hitPadWorld = (): number =>
      (HANDLE_SCREEN_PX / 2 + HIT_PAD_SCREEN_PX) / network.viewport.state.zoom

    const originalBoundsOf = (
      kind: RotatableKind,
      id: string,
    ): Rect | undefined => {
      if (kind === 'node') {
        const node = network.getNode(id)
        return node === undefined ? undefined : nodeBounds(node)
      }
      if (kind === 'group') {
        return network.getGroupBandBounds(id)
      }
      if (kind === 'path') {
        return network.getPathBounds(id)
      }
      return network.getShapeNodeBounds(id)
    }

    const angleOf = (kind: RotatableKind, id: string): number => {
      if (kind === 'node') return normalizeAngleDegrees(network.getNode(id)?.angle ?? 0)
      if (kind === 'group') return normalizeAngleDegrees(network.getGroup(id)?.angle ?? 0)
      if (kind === 'path') {
        return normalizeAngleDegrees(
          network.getPaths().find(p => p.id === id)?.angle ?? 0,
        )
      }
      return normalizeAngleDegrees(
        network.getShapeNodes().find(s => s.id === id)?.angle ?? 0,
      )
    }

    const anchorOf = (
      kind: RotatableKind,
      id: string,
    ): GraphAngleAnchor | undefined => {
      if (kind === 'node') return network.getNode(id)?.angleAnchor
      if (kind === 'group') return network.getGroup(id)?.angleAnchor
      if (kind === 'path') return network.getPaths().find(p => p.id === id)?.angleAnchor
      return network.getShapeNodes().find(s => s.id === id)?.angleAnchor
    }

    const lockedOf = (kind: RotatableKind, id: string): boolean => {
      if (kind === 'node') return network.getNode(id)?.locked === true
      if (kind === 'group') return network.getGroup(id)?.locked === true
      if (kind === 'path') {
        return network.getPaths().find(p => p.id === id)?.locked === true
      }
      return network.getShapeNodes().find(s => s.id === id)?.locked === true
    }

    const handleWorldPos = (hit: {
      originalBounds: Rect
      pivot: Point
      angle: number
    }): Point => {
      const raw: Point = {
        x: hit.originalBounds.x + hit.originalBounds.width / 2,
        y: hit.originalBounds.y - HANDLE_OFFSET_WORLD,
      }
      return rotatePointAround(raw, hit.pivot, hit.angle)
    }

    const listCandidates = (): RotateHit[] => {
      const out: RotateHit[] = []
      for (const id of network.getSelectedIds()) {
        const tryKind = (kind: RotatableKind): void => {
          if (lockedOf(kind, id)) return
          const originalBounds = originalBoundsOf(kind, id)
          if (originalBounds === undefined) return
          // Path/ShapeNode bounds from Network may already be rotated AABB.
          // Prefer element-authored geometry for path/shape via raw points when possible.
          let bounds = originalBounds
          if (kind === 'path') {
            const path = network.getPaths().find(p => p.id === id)
            if (path !== undefined && path.points.length >= 2) {
              bounds = pointsAabb(path.points) ?? bounds
            }
          } else if (kind === 'shapeNode') {
            const sn = network.getShapeNodes().find(s => s.id === id)
            if (sn !== undefined && sn.points.length >= 2) {
              bounds = pointsAabb(sn.points) ?? bounds
            }
          } else if (kind === 'node') {
            const node = network.getNode(id)
            if (node !== undefined) bounds = nodeBounds(node)
          }
          const fromAngle = angleOf(kind, id)
          const pivot = anglePivot(bounds, anchorOf(kind, id))
          out.push({ kind, id, fromAngle, pivot, originalBounds: bounds })
        }
        if (network.getNode(id) !== undefined) tryKind('node')
        else if (network.getGroup(id) !== undefined) tryKind('group')
        else if (network.getPaths().some(p => p.id === id)) tryKind('path')
        else if (network.getShapeNodes().some(s => s.id === id)) tryKind('shapeNode')
      }
      return out
    }

    const hitHandle = (worldX: number, worldY: number): RotateHit | undefined => {
      const pad = hitPadWorld()
      for (const candidate of listCandidates()) {
        const pos = handleWorldPos({
          originalBounds: candidate.originalBounds,
          pivot: candidate.pivot,
          angle: candidate.fromAngle,
        })
        if (Math.abs(worldX - pos.x) <= pad && Math.abs(worldY - pos.y) <= pad) {
          return candidate
        }
      }
      return undefined
    }

    /** twaver `_calculateAngle` idea (y-down canvas). */
    const angleFromPointer = (world: Point, pivot: Point): number =>
      Math.round(
        (Math.atan2(pivot.x - world.x, world.y - pivot.y) * 180) / Math.PI + 180,
      )

    const removeChrome = network.addOverlayChrome({
      paint(renderer) {
        const size = handleSizeWorld()
        for (const candidate of listCandidates()) {
          const pos = handleWorldPos({
            originalBounds: candidate.originalBounds,
            pivot: candidate.pivot,
            angle: angleOf(candidate.kind, candidate.id),
          })
          renderer.drawResizeHandle(pos, size)
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
        network.previewElementAngle({
          kind: active.kind,
          id: active.id,
          angle: active.fromAngle,
        })
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
      network.markGestureDragged()
      try {
        canvas.setPointerCapture(event.pointerId)
        capturedPointerId = event.pointerId
      } catch {
        // Capture unsupported.
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (active === undefined) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      const angle = angleFromPointer(world, active.pivot)
      network.previewElementAngle({
        kind: active.kind,
        id: active.id,
        angle,
      })
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (active === undefined) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      const to = normalizeAngleDegrees(angleFromPointer(world, active.pivot))
      const { kind, id, fromAngle } = active
      releaseCapture()
      active = undefined
      network.commitElementAngle({ kind, id, from: fromAngle, to })
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

function pointsAabb(
  points: readonly { readonly x: number; readonly y: number }[],
): Rect | undefined {
  if (points.length === 0) return undefined
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

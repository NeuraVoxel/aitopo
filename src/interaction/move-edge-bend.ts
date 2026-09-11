/**
 * Drag orthogonal bend handles on selected edges (Move-link equivalent).
 */

import type { Point } from '../geom.ts'
import { edgeAnchors } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const HANDLE_SIZE = 10
const HIT_PAD = 8

type Waypoint = { readonly x: number; readonly y: number }

interface BendDrag {
  readonly edgeId: string
  readonly handleIndex: number
  readonly fromWaypoints: readonly Waypoint[]
  waypoints: Waypoint[]
}

/**
 * When an edge is selected, paint bend handles and drag them with axis constraint.
 * Pack before MoveNodeInteraction so handles win hit-testing over nodes.
 */
export class MoveEdgeBendInteraction implements Interaction {
  /**
   * Attach bend-handle listeners for selected edges.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let drag: BendDrag | undefined

    const handleSize = (): number => HANDLE_SIZE / network.viewport.state.zoom

    const bendHandles = (edgeId: string): Point[] => {
      const edge = network.getEdges().find(e => e.id === edgeId)
      if (edge === undefined) return []
      const from = network.getNode(edge.from)
      const to = network.getNode(edge.to)
      if (from === undefined || to === undefined) return []
      const route = edgeAnchors(from, to, edge.waypoints)
      if (route.points.length < 3) return []
      return route.points.slice(1, -1).map(p => ({ x: p.x, y: p.y }))
    }

    const hitHandle = (
      edgeId: string,
      world: Point,
    ): { index: number; points: Point[] } | undefined => {
      const points = bendHandles(edgeId)
      const pad = HIT_PAD / network.viewport.state.zoom
      for (let i = points.length - 1; i >= 0; i -= 1) {
        const p = points[i]!
        if (
          Math.abs(world.x - p.x) <= pad + handleSize() / 2
          && Math.abs(world.y - p.y) <= pad + handleSize() / 2
        ) {
          return { index: i, points }
        }
      }
      return undefined
    }

    const removeChrome = network.addOverlayChrome({
      paint(renderer) {
        const size = handleSize()
        for (const id of network.getSelectedIds()) {
          if (!network.getEdges().some(e => e.id === id)) continue
          for (const point of bendHandles(id)) {
            renderer.drawEdgeBendHandle(point, size)
          }
        }
      },
    })

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      for (const id of network.getSelectedIds()) {
        if (!network.getEdges().some(e => e.id === id)) continue
        const hit = hitHandle(id, world)
        if (hit === undefined) continue
        const edge = network.getEdges().find(e => e.id === id)!
        const fromWaypoints = edge.waypoints !== undefined && edge.waypoints.length > 0
          ? edge.waypoints.map(p => ({ x: p.x, y: p.y }))
          : []
        const seed = fromWaypoints.length > 0
          ? fromWaypoints.map(p => ({ x: p.x, y: p.y }))
          : hit.points.map(p => ({ x: p.x, y: p.y }))
        if (fromWaypoints.length === 0) {
          network.previewEdgeWaypoints(id, seed)
        }
        drag = {
          edgeId: id,
          handleIndex: hit.index,
          fromWaypoints,
          waypoints: seed,
        }
        network.clearGestureDragged()
        network.markGestureDragged()
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
      const edge = network.getEdges().find(e => e.id === drag!.edgeId)
      if (edge === undefined) return
      const fromNode = network.getNode(edge.from)
      const toNode = network.getNode(edge.to)
      if (fromNode === undefined || toNode === undefined) return
      const anchors = edgeAnchors(fromNode, toNode, drag.waypoints)
      const full = [...anchors.points]
      const i = drag.handleIndex + 1
      if (i <= 0 || i >= full.length - 1) return
      const next = moveOrthogonalCorner(full, i, world)
      const waypoints = next.slice(1, -1).map(p => ({ x: p.x, y: p.y }))
      drag.waypoints = waypoints
      network.previewEdgeWaypoints(drag.edgeId, waypoints)
      network.markGestureDragged()
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (drag === undefined) return
      const finished = drag
      drag = undefined
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Capture may already be released.
      }
      network.commitEdgeWaypoints({
        edgeId: finished.edgeId,
        from: finished.fromWaypoints,
        to: finished.waypoints,
      })
      network.requestOverlayPaint()
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      removeChrome()
    }
  }
}

/**
 * Move corner `i` under axis constraints so adjacent segments stay orthogonal.
 * Classic two-waypoint elbows share midX or midY and update both interior points.
 * @param full - polyline including endpoints.
 * @param i - corner index in `full` (not an endpoint).
 * @param world - pointer in world space.
 * @returns next polyline points.
 */
export function moveOrthogonalCorner(
  full: readonly Point[],
  i: number,
  world: Point,
): Point[] {
  const next = full.map(p => ({ x: p.x, y: p.y }))
  const prev = next[i - 1]!
  const curr = next[i]!
  const following = next[i + 1]!
  const horizIn = Math.abs(curr.y - prev.y) < 0.5
  const vertIn = Math.abs(curr.x - prev.x) < 0.5
  const horizOut = Math.abs(following.y - curr.y) < 0.5
  const vertOut = Math.abs(following.x - curr.x) < 0.5

  // Shared vertical stem (HV elbow): both interior points share x.
  if (
    next.length === 4
    && Math.abs(next[1]!.x - next[2]!.x) < 0.5
    && Math.abs(next[1]!.y - next[0]!.y) < 0.5
    && Math.abs(next[2]!.y - next[3]!.y) < 0.5
  ) {
    const x = world.x
    next[1] = { x, y: next[1]!.y }
    next[2] = { x, y: next[2]!.y }
    return next
  }
  // Shared horizontal stem (VH elbow): both interior points share y.
  if (
    next.length === 4
    && Math.abs(next[1]!.y - next[2]!.y) < 0.5
    && Math.abs(next[1]!.x - next[0]!.x) < 0.5
    && Math.abs(next[2]!.x - next[3]!.x) < 0.5
  ) {
    const y = world.y
    next[1] = { x: next[1]!.x, y }
    next[2] = { x: next[2]!.x, y }
    return next
  }

  if (horizIn && vertOut) {
    next[i] = { x: world.x, y: prev.y }
    return next
  }
  if (vertIn && horizOut) {
    next[i] = { x: prev.x, y: world.y }
    return next
  }
  if (horizIn || horizOut) {
    next[i] = { x: world.x, y: curr.y }
    return next
  }
  if (vertIn || vertOut) {
    next[i] = { x: curr.x, y: world.y }
    return next
  }
  next[i] = { x: world.x, y: world.y }
  return next
}

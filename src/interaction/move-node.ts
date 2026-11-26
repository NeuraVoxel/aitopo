/**
 * Drag-move selected unlocked nodes, groups, freestanding paths, or shape nodes
 * (path / shapeNode body translates all control points).
 */

import { nodeBounds } from '../ui/bounds.ts'
import { listDescendantGroupIds, listDescendantNodeIds } from '../ui/group-state.ts'
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

type NodeMover = { kind: 'node'; id: string; fromX: number; fromY: number }
type GroupMover = {
  kind: 'group'
  id: string
  fromX: number
  fromY: number
  members: readonly { id: string; fromX: number; fromY: number }[]
  childGroups: readonly { id: string; fromX: number; fromY: number }[]
}
type PathMover = {
  kind: 'path'
  id: string
  fromPoints: readonly { x: number; y: number }[]
}
type ShapeNodeMover = {
  kind: 'shapeNode'
  id: string
  closed: boolean
  fromPoints: readonly { x: number; y: number }[]
}

type Mover = NodeMover | GroupMover | PathMover | ShapeNodeMover

/** Live- or lazy-move nodes/groups/paths/shapeNodes; skip locked; reparent from group under pointer on commit. */
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
   * Attach pointer listeners for node/group move.
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
    let movers: Mover[] = []
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
            const group = network.getGroup(dropTargetGroupId)
            const band = network.getGroupBandBounds(dropTargetGroupId)
            // Paint the target group exactly as selection does — its own
            // selectStyle over its live band — instead of a foreign rect.
            if (group !== undefined && band !== undefined) {
              renderer.drawSelectionOverlay(band, group.style?.select)
            }
          }
          if (!lazyMove || !dragged) return
          for (const mover of movers) {
            if (mover.kind === 'node') {
              const node = network.getNode(mover.id)
              if (node === undefined) continue
              renderer.drawLazyMoveGhost(nodeBounds({
                ...node,
                x: mover.fromX + dx,
                y: mover.fromY + dy,
              }))
            } else if (mover.kind === 'group') {
              const group = network.getGroup(mover.id)
              if (group !== undefined) {
                renderer.drawLazyMoveGhost({
                  x: (group.x ?? 0) - ((group.x ?? 0) - mover.fromX) + dx,
                  y: (group.y ?? 0) - ((group.y ?? 0) - mover.fromY) + dy,
                  width: group.w ?? 50,
                  height: group.h ?? 78,
                })
              }
              for (const member of mover.members) {
                const node = network.getNode(member.id)
                if (node === undefined) continue
                renderer.drawLazyMoveGhost(nodeBounds({
                  ...node,
                  x: member.fromX + dx,
                  y: member.fromY + dy,
                }))
              }
            } else {
              // path or shapeNode body ghost
              for (let i = 0; i < mover.fromPoints.length - 1; i += 1) {
                const a = mover.fromPoints[i]!
                const b = mover.fromPoints[i + 1]!
                renderer.drawEdgeRubberBand(
                  { x: a.x + dx, y: a.y + dy },
                  { x: b.x + dx, y: b.y + dy },
                )
              }
              if (
                mover.kind === 'shapeNode'
                && mover.closed
                && mover.fromPoints.length >= 2
              ) {
                const last = mover.fromPoints[mover.fromPoints.length - 1]!
                const first = mover.fromPoints[0]!
                renderer.drawEdgeRubberBand(
                  { x: last.x + dx, y: last.y + dy },
                  { x: first.x + dx, y: first.y + dy },
                )
              }
            }
          }
        },
      })
    }

    /** Revert live previews to drag-start positions, release capture, clear state. */
    const abortWithoutCommit = (): void => {
      if (active && dragged && !lazyMove) {
        for (const mover of movers) {
          if (mover.kind === 'node') {
            network.previewNodePosition(mover.id, mover.fromX, mover.fromY)
          } else if (mover.kind === 'group') {
            network.previewGroupMove({
              groupId: mover.id,
              dx: 0,
              dy: 0,
              groupFrom: { x: mover.fromX, y: mover.fromY },
              members: mover.members,
            })
          } else if (mover.kind === 'path') {
            network.previewPathPoints(mover.id, mover.fromPoints)
          } else if (mover.kind === 'shapeNode') {
            network.previewShapeNodePoints(mover.id, mover.fromPoints)
          }
        }
      }
      clearPaintFilter()
      clearChrome()
      releaseCapture()
      reset()
    }

    const collectGroupMembers = (groupId: string): {
      members: { id: string; fromX: number; fromY: number }[]
      childGroups: { id: string; fromX: number; fromY: number }[]
    } => {
      const group = network.getGroup(groupId)
      if (group === undefined) return { members: [], childGroups: [] }
      // Build a lightweight scene facade for descendant walks.
      const scene = {
        nodes: new Map(network.getNodes().map(n => [n.id, n])),
        groups: new Map(network.getGroups().map(g => [g.id, g])),
      }
      const members: { id: string; fromX: number; fromY: number }[] = []
      for (const id of listDescendantNodeIds(scene as never, group)) {
        const node = network.getNode(id)
        if (node === undefined || node.locked === true || !network.isLayerMovable(id)) continue
        members.push({ id, fromX: node.x ?? 0, fromY: node.y ?? 0 })
      }
      const childGroups: { id: string; fromX: number; fromY: number }[] = []
      for (const id of listDescendantGroupIds(scene as never, group)) {
        const child = network.getGroup(id)
        if (child === undefined || child.locked === true || !network.isLayerMovable(id)) continue
        childGroups.push({ id, fromX: child.x ?? 0, fromY: child.y ?? 0 })
      }
      return { members, childGroups }
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      // Alt+drag is CreateEdge; leave that gesture alone.
      if (event.altKey) return
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      if (
        hit === undefined
        || (
          hit.kind !== 'node'
          && hit.kind !== 'group'
          && hit.kind !== 'path'
          && hit.kind !== 'shapeNode'
        )
      ) {
        return
      }

      let selectedIds = network.getSelectedIds()
      if (!selectedIds.includes(hit.id)) {
        network.setSelection([hit.id])
        selectedIds = [hit.id]
      }

      const nextMovers: Mover[] = []
      const coveredMembers = new Set<string>()

      for (const id of selectedIds) {
        const group = network.getGroup(id)
        if (group !== undefined) {
          if (group.locked === true || !network.isLayerMovable(id)) continue
          const { members, childGroups } = collectGroupMembers(id)
          for (const member of members) coveredMembers.add(member.id)
          for (const child of childGroups) coveredMembers.add(child.id)
          nextMovers.push({
            kind: 'group',
            id,
            fromX: group.x ?? 0,
            fromY: group.y ?? 0,
            members,
            childGroups,
          })
          continue
        }
        const path = network.getPaths().find(p => p.id === id)
        if (path !== undefined) {
          if (path.locked === true || !network.isLayerMovable(id)) continue
          nextMovers.push({
            kind: 'path',
            id,
            fromPoints: path.points.map(p => ({ x: p.x, y: p.y })),
          })
          continue
        }
        const shapeNode = network.getShapeNodes().find(s => s.id === id)
        if (shapeNode !== undefined) {
          if (shapeNode.locked === true || !network.isLayerMovable(id)) continue
          nextMovers.push({
            kind: 'shapeNode',
            id,
            closed: shapeNode.closed !== false,
            fromPoints: shapeNode.points.map(p => ({ x: p.x, y: p.y })),
          })
          continue
        }
        if (coveredMembers.has(id)) continue
        const node = network.getNode(id)
        if (node === undefined || node.locked === true || !network.isLayerMovable(id)) continue
        nextMovers.push({
          kind: 'node',
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
          if (mover.kind === 'node') {
            network.previewNodePosition(mover.id, mover.fromX + dx, mover.fromY + dy)
          } else if (mover.kind === 'group') {
            network.previewGroupMove({
              groupId: mover.id,
              dx,
              dy,
              groupFrom: { x: mover.fromX, y: mover.fromY },
              members: mover.members,
              childGroups: mover.childGroups,
            })
          } else if (mover.kind === 'path') {
            network.previewPathPoints(
              mover.id,
              mover.fromPoints.map(p => ({ x: p.x + dx, y: p.y + dy })),
            )
          } else if (mover.kind === 'shapeNode') {
            network.previewShapeNodePoints(
              mover.id,
              mover.fromPoints.map(p => ({ x: p.x + dx, y: p.y + dy })),
            )
          }
        }
      }
    }

    /** Whether the node already belongs to the group (`groupId` ∪ `memberIds`). */
    const nodeBelongsToGroup = (nodeId: string, groupId: string): boolean => {
      const node = network.getNode(nodeId)
      if (node?.groupId === groupId) return true
      return network.getGroup(groupId)?.memberIds.includes(nodeId) === true
    }

    const isNonReparentMover = (m: Mover): boolean =>
      m.kind === 'group' || m.kind === 'path' || m.kind === 'shapeNode'

    const updateDropTarget = (clientX: number, clientY: number): void => {
      // Group-only / path-only / shapeNode-only drags do not reparent via drop target.
      if (movers.every(isNonReparentMover)) {
        dropTargetGroupId = undefined
        clearChrome()
        return
      }
      const rect = canvas.getBoundingClientRect()
      const candidate = network.hitTestGroupScreen(
        clientX - rect.left,
        clientY - rect.top,
      )
      // Dropping into the group a node already sits in is a no-op; only
      // highlight groups that would take at least one new member.
      dropTargetGroupId = candidate !== undefined
        && movers.some(m => m.kind === 'node' && !nodeBelongsToGroup(m.id, candidate))
        ? candidate
        : undefined
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
          const filterIds: string[] = []
          for (const mover of movers) {
            if (mover.kind === 'node') filterIds.push(mover.id)
            else if (mover.kind === 'group') filterIds.push(...mover.members.map(m => m.id))
            // Paths / shapeNodes are not in the node paint filter; keep full scene.
          }
          if (filterIds.length > 0) network.setDragPaintFilter(filterIds)
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
        const groupHit = movers.every(isNonReparentMover)
          ? undefined
          : network.hitTestGroupScreen(
            event.clientX - rect.left,
            event.clientY - rect.top,
          )
        for (const mover of movers) {
          if (mover.kind === 'group') {
            network.commitGroupMove({
              groupId: mover.id,
              groupFrom: { x: mover.fromX, y: mover.fromY },
              groupTo: { x: mover.fromX + finalDx, y: mover.fromY + finalDy },
              members: mover.members.map(member => ({
                id: member.id,
                from: { x: member.fromX, y: member.fromY },
                to: { x: member.fromX + finalDx, y: member.fromY + finalDy },
              })),
              childGroups: mover.childGroups.map(child => ({
                id: child.id,
                from: { x: child.fromX, y: child.fromY },
                to: { x: child.fromX + finalDx, y: child.fromY + finalDy },
              })),
            })
          } else if (mover.kind === 'path') {
            network.commitPathUpdate({
              pathId: mover.id,
              patch: {
                points: mover.fromPoints.map(p => ({
                  x: p.x + finalDx,
                  y: p.y + finalDy,
                })),
              },
            })
          } else if (mover.kind === 'shapeNode') {
            network.commitShapeNodeUpdate({
              shapeNodeId: mover.id,
              patch: {
                points: mover.fromPoints.map(p => ({
                  x: p.x + finalDx,
                  y: p.y + finalDy,
                })),
              },
            })
          } else {
            network.commitNodeMove({
              nodeId: mover.id,
              from: { x: mover.fromX, y: mover.fromY },
              to: { x: mover.fromX + finalDx, y: mover.fromY + finalDy },
              toGroupId: groupHit,
            })
          }
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

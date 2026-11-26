/**
 * Editor gesture state: drag filter, gesture flag, preview + commit mutations.
 */

import { growRect, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import type { GraphPath, GraphShapeNode } from '../protocol/types.ts'
import {
  expandCollapseCenterPatches,
  listOwningGroupChain,
  listOwningGroupChainForShapeNode,
} from '../ui/group-state.ts'
import type { DirtyAccumulator } from './dirty.ts'
import { elementPaintPad } from './paint-pad.ts'
import type { ViewSet } from '../ui/view-set.ts'

/** Collaborators GestureEditor needs from Network. */
export interface GestureEditorDeps {
  readonly scene: GraphScene
  readonly views: ViewSet
  readonly dirty: DirtyAccumulator
  /** Schedule root + overlay paint. */
  scheduleScenePaint(): void
  /**
   * Apply a patch (Network.apply — may route through history).
   * @param patch - structural ops.
   */
  apply(patch: GraphPatch): void
  /**
   * Fan out a GraphEvent.
   * @param event - event payload.
   */
  emit(event: GraphEvent): void
}

/**
 * Owns live-edit preview/commit and drag paint filtering.
 */
export class GestureEditor {
  private gestureDragged = false
  private filter: ReadonlySet<string> | undefined

  constructor(private readonly deps: GestureEditorDeps) {}

  /** Node ids kept visible during filtered drag, or undefined for full scene. */
  get dragPaintFilter(): ReadonlySet<string> | undefined {
    return this.filter
  }

  /**
   * Restrict paint to mover node ids (+ incident edges). Pass `undefined` for full scene.
   * @param nodeIds - ids to keep visible during drag, or undefined to clear.
   */
  setDragPaintFilter(nodeIds: readonly string[] | undefined): void {
    this.filter = nodeIds === undefined ? undefined : new Set(nodeIds)
    this.deps.dirty.markAll()
    this.deps.scheduleScenePaint()
  }

  /** Mark that a drag consumed this pointer gesture. */
  markGestureDragged(): void {
    this.gestureDragged = true
  }

  /** @returns true when markGestureDragged ran since the last clear. */
  wasGestureDragged(): boolean {
    return this.gestureDragged
  }

  /** Reset the drag-consumed flag. */
  clearGestureDragged(): void {
    this.gestureDragged = false
  }

  /**
   * Live preview position during drag (no nodeMoved / documentChanged).
   * @param id - node id.
   * @param x - world x.
   * @param y - world y.
   */
  previewNodePosition(id: string, x: number, y: number): void {
    if (this.deps.scene.nodes.get(id) === undefined) return
    this.previewNodeGeometry(id, () => {
      this.deps.scene.writePositions({ [id]: { x, y } })
    })
  }

  /**
   * Live preview bounds during resize.
   * @param id - node id.
   * @param bounds - world x/y/w/h.
   */
  previewNodeBounds(
    id: string,
    bounds: { x: number; y: number; w: number; h: number },
  ): void {
    if (this.deps.scene.nodes.get(id) === undefined) return
    this.previewNodeGeometry(id, () => {
      this.deps.scene.writeBounds({ [id]: bounds })
    })
  }

  /**
   * Commit a node move with optional group membership change.
   *
   * `toGroupId` sentinel (presence vs value):
   * - property omitted → membership unchanged
   * - `toGroupId: undefined` (key present) → clear membership
   * - `toGroupId: 'g…'` → reparent into that group
   *
   * @param args - from/to positions and optional target group id.
   */
  commitNodeMove(args: {
    nodeId: string
    from: { x: number; y: number }
    to: { x: number; y: number }
    toGroupId?: string | undefined
  }): void {
    const node = this.deps.scene.nodes.get(args.nodeId)
    if (node === undefined) {
      throw new Error(`commitNodeMove: missing node ${args.nodeId}`)
    }
    const fromGroupId = node.groupId
    const membershipRequested = Object.hasOwn(args, 'toGroupId')
    const toGroupId = args.toGroupId
    const membershipChanged = membershipRequested && fromGroupId !== toGroupId

    const ops: GraphPatch['ops'] = [
      { op: 'updateNode', id: args.nodeId, patch: { x: args.to.x, y: args.to.y } },
    ]

    if (membershipChanged) {
      if (fromGroupId !== undefined) {
        const fromGroup = this.deps.scene.groups.get(fromGroupId)
        if (fromGroup !== undefined) {
          ops.push({
            op: 'updateGroup',
            id: fromGroupId,
            patch: { memberIds: fromGroup.memberIds.filter(id => id !== args.nodeId) },
          })
        }
      }
      if (toGroupId !== undefined) {
        const toGroup = this.deps.scene.groups.get(toGroupId)
        if (toGroup === undefined) {
          throw new Error(`commitNodeMove: missing group ${toGroupId}`)
        }
        const memberIds = toGroup.memberIds.includes(args.nodeId)
          ? [...toGroup.memberIds]
          : [...toGroup.memberIds, args.nodeId]
        ops.push({ op: 'updateGroup', id: toGroupId, patch: { memberIds } })
        ops[0] = {
          op: 'updateNode',
          id: args.nodeId,
          patch: { x: args.to.x, y: args.to.y, groupId: toGroupId },
        }
      } else {
        ops[0] = {
          op: 'updateNode',
          id: args.nodeId,
          patch: { x: args.to.x, y: args.to.y, groupId: null },
        }
      }
    }

    this.deps.apply({ ops })
    this.deps.emit({
      type: 'nodeMoved',
      nodeId: args.nodeId,
      from: { x: args.from.x, y: args.from.y },
      to: { x: args.to.x, y: args.to.y },
    })
    if (membershipChanged) {
      this.deps.emit({
        type: 'groupMembershipChanged',
        nodeId: args.nodeId,
        fromGroupId,
        toGroupId,
      })
    }
  }

  /**
   * Live preview of a group drag (group origin + member nodes).
   * @param args - deltas and drag-start origins.
   */
  previewGroupMove(args: {
    groupId: string
    dx: number
    dy: number
    groupFrom: { x: number; y: number }
    members: readonly { id: string; fromX: number; fromY: number }[]
    childGroups?: readonly { id: string; fromX: number; fromY: number }[]
  }): void {
    if (this.deps.scene.groups.get(args.groupId) === undefined) return
    const positions: Record<string, { x: number; y: number }> = {}
    for (const member of args.members) {
      positions[member.id] = {
        x: member.fromX + args.dx,
        y: member.fromY + args.dy,
      }
    }
    this.deps.scene.writePositions(positions)
    const groupPositions: Record<string, { x: number; y: number }> = {
      [args.groupId]: {
        x: args.groupFrom.x + args.dx,
        y: args.groupFrom.y + args.dy,
      },
    }
    for (const child of args.childGroups ?? []) {
      groupPositions[child.id] = {
        x: child.fromX + args.dx,
        y: child.fromY + args.dy,
      }
    }
    this.deps.scene.writeGroupPositions(groupPositions)
    this.deps.views.markGroupGeometryDirty(this.deps.scene, args.groupId)
    this.deps.dirty.markAll()
    this.deps.scheduleScenePaint()
  }

  /**
   * Commit a group drag: updateGroup x/y and member node positions.
   * @param args - group and member from/to.
   */
  commitGroupMove(args: {
    groupId: string
    groupFrom: { x: number; y: number }
    groupTo: { x: number; y: number }
    members: readonly {
      id: string
      from: { x: number; y: number }
      to: { x: number; y: number }
    }[]
    childGroups?: readonly {
      id: string
      from: { x: number; y: number }
      to: { x: number; y: number }
    }[]
  }): void {
    if (this.deps.scene.groups.get(args.groupId) === undefined) {
      throw new Error(`commitGroupMove: missing group ${args.groupId}`)
    }
    const ops: GraphPatch['ops'] = [
      {
        op: 'updateGroup',
        id: args.groupId,
        patch: { x: args.groupTo.x, y: args.groupTo.y },
      },
      ...(args.childGroups ?? []).map(child => ({
        op: 'updateGroup' as const,
        id: child.id,
        patch: { x: child.to.x, y: child.to.y },
      })),
      ...args.members.map(member => ({
        op: 'updateNode' as const,
        id: member.id,
        patch: { x: member.to.x, y: member.to.y },
      })),
    ]
    this.deps.apply({ ops })
    for (const member of args.members) {
      this.deps.emit({
        type: 'nodeMoved',
        nodeId: member.id,
        from: { x: member.from.x, y: member.from.y },
        to: { x: member.to.x, y: member.to.y },
      })
    }
  }

  /**
   * Toggle group expand/collapse via `updateGroup` (no-op when missing or locked).
   * Preserves the shared frame: collapse writes the painted band's x/y/w/h so
   * size does not jump; expand translates members so the auto-fit band
   * recenters on the collapsed body. Band extents come from validated views
   * (member attachments included), not the body-only union.
   * @param groupId - group id.
   */
  toggleGroupExpanded(groupId: string): void {
    const group = this.deps.scene.groups.get(groupId)
    if (group === undefined || group.locked === true) return
    const nextExpanded = group.expanded !== true
    this.deps.views.validateDirty(this.deps.scene)
    const { groupPatch, memberMoves, childGroupMoves } = expandCollapseCenterPatches(
      this.deps.scene,
      group,
      nextExpanded,
      node => this.deps.views.nodeUnionBounds(node),
    )
    const ops: GraphPatch['ops'] = [
      { op: 'updateGroup', id: groupId, patch: groupPatch },
      ...childGroupMoves.map(move => ({
        op: 'updateGroup' as const,
        id: move.id,
        patch: { x: move.to.x, y: move.to.y },
      })),
      ...memberMoves.map(move => ({
        op: 'updateNode' as const,
        id: move.id,
        patch: { x: move.to.x, y: move.to.y },
      })),
    ]
    this.deps.apply({ ops })
    for (const move of memberMoves) {
      this.deps.emit({
        type: 'nodeMoved',
        nodeId: move.id,
        from: move.from,
        to: move.to,
      })
    }
  }

  /**
   * Commit a node resize.
   * @param args - from/to bounds.
   */
  commitNodeResize(args: {
    nodeId: string
    from: { x: number; y: number; w: number; h: number }
    to: { x: number; y: number; w: number; h: number }
  }): void {
    if (this.deps.scene.nodes.get(args.nodeId) === undefined) {
      throw new Error(`commitNodeResize: missing node ${args.nodeId}`)
    }
    this.deps.apply({
      ops: [{
        op: 'updateNode',
        id: args.nodeId,
        patch: {
          x: args.to.x,
          y: args.to.y,
          w: args.to.w,
          h: args.to.h,
        },
      }],
    })
    this.deps.emit({
      type: 'nodeResized',
      nodeId: args.nodeId,
      from: { ...args.from },
      to: { ...args.to },
    })
  }

  /**
   * Commit a new directed edge. Skips when endpoints missing, identical, or duplicate.
   * @param args - endpoints and optional kind / id.
   * @returns created edge id, or undefined when skipped.
   */
  commitEdgeCreate(args: {
    from: string
    to: string
    kind?: string
    id?: string
  }): string | undefined {
    if (args.from === args.to) return undefined
    const endpointOk = (id: string): boolean =>
      this.deps.scene.nodes.get(id) !== undefined
      || this.deps.scene.groups.get(id) !== undefined
    if (!endpointOk(args.from) || !endpointOk(args.to)) return undefined
    for (const edge of this.deps.scene.edges.values()) {
      if (edge.from === args.from && edge.to === args.to) return undefined
    }
    const edgeId = args.id ?? `e-${args.from}-${args.to}-${Date.now()}`
    if (this.deps.scene.edges.has(edgeId)) return undefined
    this.deps.apply({
      ops: [{
        op: 'addEdge',
        edge: {
          id: edgeId,
          from: args.from,
          to: args.to,
          ...(args.kind !== undefined ? { kind: args.kind } : {}),
        },
      }],
    })
    this.deps.emit({
      type: 'edgeCreated',
      edgeId,
      from: args.from,
      to: args.to,
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
    })
    return edgeId
  }

  /**
   * Remove edges by id; emits `edgeRemoved` for each existing id.
   * @param edgeIds - edge ids to remove.
   */
  commitEdgeRemove(edgeIds: readonly string[]): void {
    const ops: GraphPatch['ops'] = []
    const removed: string[] = []
    for (const id of edgeIds) {
      if (!this.deps.scene.edges.has(id)) continue
      ops.push({ op: 'removeEdge', id })
      removed.push(id)
    }
    if (ops.length === 0) return
    this.deps.apply({ ops })
    for (const edgeId of removed) {
      this.deps.emit({ type: 'edgeRemoved', edgeId })
    }
  }

  /**
   * Live preview of edge bend waypoints.
   * @param edgeId - edge id.
   * @param waypoints - intermediate points (empty clears to auto).
   */
  previewEdgeWaypoints(
    edgeId: string,
    waypoints: readonly { readonly x: number; readonly y: number }[],
  ): void {
    if (this.deps.scene.edges.get(edgeId) === undefined) return
    const oldRects = this.captureEdgeGeometryRects(edgeId)
    this.deps.scene.writeEdgeWaypoints(edgeId, waypoints)
    this.deps.views.markDirty(edgeId)
    this.deps.views.validateDirty(this.deps.scene)
    for (const rect of oldRects) this.deps.dirty.add(rect)
    for (const rect of this.captureEdgeGeometryRects(edgeId)) this.deps.dirty.add(rect)
    this.deps.scene.takeDirty()
    this.deps.scheduleScenePaint()
  }

  /**
   * Live preview of path control points (body / vertex drag; no pathUpdated).
   * @param pathId - path id.
   * @param points - control points.
   */
  previewPathPoints(
    pathId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void {
    if (this.deps.scene.paths.get(pathId) === undefined) return
    const oldRects = this.capturePathGeometryRects(pathId)
    this.deps.scene.writePathPoints(pathId, points)
    this.deps.views.markDirty(pathId)
    this.deps.views.validateDirty(this.deps.scene)
    for (const rect of oldRects) this.deps.dirty.add(rect)
    for (const rect of this.capturePathGeometryRects(pathId)) this.deps.dirty.add(rect)
    this.deps.scene.takeDirty()
    this.deps.scheduleScenePaint()
  }

  /**
   * Live preview of shape-node control points (body / vertex drag; no shapeNodeUpdated).
   * Dirties owning group bands (and ancestors) when the shape node is a member so
   * auto-fit old/new rects clear with the body.
   * @param shapeNodeId - shape-node id.
   * @param points - control points.
   */
  previewShapeNodePoints(
    shapeNodeId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void {
    if (this.deps.scene.shapeNodes.get(shapeNodeId) === undefined) return
    const oldRects = this.captureShapeNodeGeometryRects(shapeNodeId)
    this.deps.scene.writeShapeNodePoints(shapeNodeId, points)
    this.deps.views.markDirty(shapeNodeId)
    for (const groupId of listOwningGroupChainForShapeNode(
      this.deps.scene,
      shapeNodeId,
    )) {
      this.deps.views.markDirty(groupId)
    }
    this.deps.views.validateDirty(this.deps.scene)
    for (const rect of oldRects) this.deps.dirty.add(rect)
    for (const rect of this.captureShapeNodeGeometryRects(shapeNodeId)) {
      this.deps.dirty.add(rect)
    }
    this.deps.scene.takeDirty()
    this.deps.scheduleScenePaint()
  }

  /**
   * Commit edge bend waypoints; emits `edgeWaypointsChanged`.
   * @param args - edge id and from/to waypoint lists.
   */
  commitEdgeWaypoints(args: {
    edgeId: string
    from: readonly { readonly x: number; readonly y: number }[]
    to: readonly { readonly x: number; readonly y: number }[]
  }): void {
    if (this.deps.scene.edges.get(args.edgeId) === undefined) {
      throw new Error(`commitEdgeWaypoints: missing edge ${args.edgeId}`)
    }
    this.deps.apply({
      ops: [{
        op: 'updateEdge',
        id: args.edgeId,
        patch: { waypoints: args.to.map(p => ({ x: p.x, y: p.y })) },
      }],
    })
    this.deps.emit({
      type: 'edgeWaypointsChanged',
      edgeId: args.edgeId,
      from: args.from.map(p => ({ x: p.x, y: p.y })),
      to: args.to.map(p => ({ x: p.x, y: p.y })),
    })
  }

  /**
   * Commit a new freestanding path. Skips when fewer than two points or id collision.
   * @param args - control points and optional style / id / closed.
   * @returns created path id, or undefined when skipped.
   */
  commitPathCreate(args: {
    points: readonly { readonly x: number; readonly y: number }[]
    closed?: boolean
    style?: GraphPath['style']
    label?: string
    id?: string
  }): string | undefined {
    if (args.points.length < 2) return undefined
    const pathId = args.id ?? `p-${Date.now()}`
    if (
      this.deps.scene.paths.has(pathId)
      || this.deps.scene.nodes.has(pathId)
      || this.deps.scene.edges.has(pathId)
      || this.deps.scene.groups.has(pathId)
      || this.deps.scene.shapeNodes.has(pathId)
    ) {
      return undefined
    }
    this.deps.apply({
      ops: [{
        op: 'addPath',
        path: {
          id: pathId,
          points: args.points.map(p => ({ x: p.x, y: p.y })),
          ...(args.closed !== undefined ? { closed: args.closed } : {}),
          ...(args.label !== undefined ? { label: args.label } : {}),
          ...(args.style !== undefined ? { style: clonePathStyle(args.style) } : {}),
        },
      }],
    })
    this.deps.emit({ type: 'pathCreated', pathId })
    return pathId
  }

  /**
   * Commit a path update; emits `pathUpdated`.
   * @param args - path id and patch fragment.
   */
  commitPathUpdate(args: {
    pathId: string
    patch: {
      points?: readonly { readonly x: number; readonly y: number }[]
      closed?: boolean
      label?: string
      locked?: boolean
      style?: GraphPath['style']
    }
  }): void {
    if (this.deps.scene.paths.get(args.pathId) === undefined) {
      throw new Error(`commitPathUpdate: missing path ${args.pathId}`)
    }
    const { points, style, ...rest } = args.patch
    this.deps.apply({
      ops: [{
        op: 'updatePath',
        id: args.pathId,
        patch: {
          ...rest,
          ...(points !== undefined
            ? { points: points.map(p => ({ x: p.x, y: p.y })) }
            : {}),
          ...(style !== undefined ? { style: clonePathStyle(style) } : {}),
        },
      }],
    })
    this.deps.emit({ type: 'pathUpdated', pathId: args.pathId })
  }

  /**
   * Remove paths by id; emits `pathRemoved` for each existing id.
   * @param pathIds - path ids to remove.
   */
  commitPathRemove(pathIds: readonly string[]): void {
    const ops: GraphPatch['ops'] = []
    const removed: string[] = []
    for (const id of pathIds) {
      if (!this.deps.scene.paths.has(id)) continue
      ops.push({ op: 'removePath', id })
      removed.push(id)
    }
    if (ops.length === 0) return
    this.deps.apply({ ops })
    for (const pathId of removed) {
      this.deps.emit({ type: 'pathRemoved', pathId })
    }
  }

  /**
   * Commit a new shape node. Skips when fewer than two points or id collision.
   * Omitted `closed` ≡ closed (ShapeNode default); pass `closed: false` for open.
   * @param args - control points and optional style / id / closed.
   * @returns created shape-node id, or undefined when skipped.
   */
  commitShapeNodeCreate(args: {
    points: readonly { readonly x: number; readonly y: number }[]
    closed?: boolean
    style?: GraphShapeNode['style']
    label?: string
    id?: string
  }): string | undefined {
    if (args.points.length < 2) return undefined
    const shapeNodeId = args.id ?? `sn-${Date.now()}`
    if (
      this.deps.scene.shapeNodes.has(shapeNodeId)
      || this.deps.scene.nodes.has(shapeNodeId)
      || this.deps.scene.edges.has(shapeNodeId)
      || this.deps.scene.groups.has(shapeNodeId)
      || this.deps.scene.paths.has(shapeNodeId)
    ) {
      return undefined
    }
    this.deps.apply({
      ops: [{
        op: 'addShapeNode',
        shapeNode: {
          id: shapeNodeId,
          points: args.points.map(p => ({ x: p.x, y: p.y })),
          ...(args.closed !== undefined ? { closed: args.closed } : {}),
          ...(args.label !== undefined ? { label: args.label } : {}),
          ...(args.style !== undefined ? { style: cloneShapeNodeStyle(args.style) } : {}),
        },
      }],
    })
    this.deps.emit({ type: 'shapeNodeCreated', shapeNodeId })
    return shapeNodeId
  }

  /**
   * Commit a shape-node update; emits `shapeNodeUpdated`.
   * @param args - shape-node id and patch fragment.
   */
  commitShapeNodeUpdate(args: {
    shapeNodeId: string
    patch: {
      points?: readonly { readonly x: number; readonly y: number }[]
      closed?: boolean
      label?: string
      locked?: boolean
      style?: GraphShapeNode['style']
    }
  }): void {
    if (this.deps.scene.shapeNodes.get(args.shapeNodeId) === undefined) {
      throw new Error(`commitShapeNodeUpdate: missing shapeNode ${args.shapeNodeId}`)
    }
    const { points, style, ...rest } = args.patch
    this.deps.apply({
      ops: [{
        op: 'updateShapeNode',
        id: args.shapeNodeId,
        patch: {
          ...rest,
          ...(points !== undefined
            ? { points: points.map(p => ({ x: p.x, y: p.y })) }
            : {}),
          ...(style !== undefined ? { style: cloneShapeNodeStyle(style) } : {}),
        },
      }],
    })
    this.deps.emit({ type: 'shapeNodeUpdated', shapeNodeId: args.shapeNodeId })
  }

  /**
   * Remove shape nodes by id; emits `shapeNodeRemoved` for each existing id.
   * @param shapeNodeIds - shape-node ids to remove.
   */
  commitShapeNodeRemove(shapeNodeIds: readonly string[]): void {
    const ops: GraphPatch['ops'] = []
    const removed: string[] = []
    for (const id of shapeNodeIds) {
      if (!this.deps.scene.shapeNodes.has(id)) continue
      ops.push({ op: 'removeShapeNode', id })
      removed.push(id)
    }
    if (ops.length === 0) return
    this.deps.apply({ ops })
    for (const shapeNodeId of removed) {
      this.deps.emit({ type: 'shapeNodeRemoved', shapeNodeId })
    }
  }

  private previewNodeGeometry(id: string, mutate: () => void): void {
    const oldRects = this.captureNodeGeometryRects(id)
    const oldGroupRects = this.captureNodeGroupRects(id)
    mutate()
    this.deps.views.markNodeGeometryDirty(this.deps.scene, id)
    this.deps.views.validateDirty(this.deps.scene)
    for (const rect of oldRects) this.deps.dirty.add(rect)
    for (const rect of this.captureNodeGeometryRects(id)) this.deps.dirty.add(rect)
    // Auto-fit bands recompute from member positions during validate; without
    // their old/new rects the repaint clip skips the band and leaves ghosts.
    for (const rect of oldGroupRects) this.deps.dirty.add(rect)
    for (const rect of this.captureNodeGroupRects(id)) this.deps.dirty.add(rect)
    this.deps.scene.takeDirty()
    if (this.filter !== undefined) {
      this.deps.dirty.markAll()
    }
    this.deps.scheduleScenePaint()
  }

  private captureNodeGeometryRects(nodeId: string): Rect[] {
    const rects: Rect[] = []
    const nodeView = this.deps.views.getNode(nodeId)
    if (nodeView?.isActive === true) {
      rects.push(growRect(nodeView.bounds, this.nodePaintPad(nodeId)))
    }
    const groupIds = new Set(listOwningGroupChain(this.deps.scene, nodeId))
    for (const edge of this.deps.scene.edges.values()) {
      if (
        edge.from !== nodeId
        && edge.to !== nodeId
        && !groupIds.has(edge.from)
        && !groupIds.has(edge.to)
      ) continue
      const edgeView = this.deps.views.getEdge(edge.id)
      if (edgeView?.isActive === true) rects.push(growRect(edgeView.bounds, 8))
      // Edge dirty often clips only a strip of the far endpoint. Partial clear +
      // clip through that body leaves shadow / AA seams (hello From residual).
      const otherId = edge.from === nodeId || groupIds.has(edge.from)
        ? edge.to
        : edge.from
      this.pushEndpointPaintRect(rects, otherId)
    }
    return rects
  }

  /** Grow pad covering drop shadow and selection glow for a node id. */
  private nodePaintPad(nodeId: string): number {
    const paint = this.deps.views.getNode(nodeId)?.toPaintView(
      this.deps.scene.selectedIds.has(nodeId),
      false,
    )
    return elementPaintPad({
      shadowBlur: paint?.shadow?.blur,
      shadowOffsetY: paint?.shadow?.offsetY,
      selected: paint?.selected,
      glow: paint?.selectStyle?.glow,
      glowBlur: paint?.selectStyle?.glowBlur,
    })
  }

  private pushEndpointPaintRect(rects: Rect[], endpointId: string): void {
    const nodeView = this.deps.views.getNode(endpointId)
    if (nodeView?.isActive === true) {
      rects.push(growRect(nodeView.bounds, this.nodePaintPad(endpointId)))
      return
    }
    const groupView = this.deps.views.getGroup(endpointId)
    if (groupView?.isActive !== true) return
    const selected = this.deps.scene.selectedIds.has(endpointId)
    const paint = groupView.toPaintView(selected, false)
    rects.push(growRect(groupView.bounds, elementPaintPad({
      shadowBlur: paint.shadow?.blur,
      shadowOffsetY: paint.shadow?.offsetY,
      selected,
      glow: paint.selectStyle?.glow,
      glowBlur: paint.selectStyle?.glowBlur,
    })))
  }

  /** Bounds of owning groups and ancestors (auto-fit chain). */
  private captureNodeGroupRects(nodeId: string): Rect[] {
    const rects: Rect[] = []
    for (const id of listOwningGroupChain(this.deps.scene, nodeId)) {
      const groupView = this.deps.views.getGroup(id)
      if (groupView?.isActive === true) rects.push(growRect(groupView.bounds, 8))
    }
    return rects
  }

  private captureEdgeGeometryRects(edgeId: string): Rect[] {
    const edgeView = this.deps.views.getEdge(edgeId)
    if (edgeView?.isActive !== true) return []
    return [growRect(edgeView.bounds, 8)]
  }

  private capturePathGeometryRects(pathId: string): Rect[] {
    const pathView = this.deps.views.getPath(pathId)
    // PathView has no isActive flag; skip only when densify produced nothing.
    if (pathView === undefined || pathView.points.length < 2) return []
    const selected = this.deps.scene.selectedIds.has(pathId)
    const paint = pathView.toPaintView(selected, false)
    return [growRect(pathView.bounds, elementPaintPad({
      selected,
      glow: paint.selectStyle?.glow,
      glowBlur: paint.selectStyle?.glowBlur,
    }))]
  }

  private captureShapeNodeGeometryRects(shapeNodeId: string): Rect[] {
    const rects: Rect[] = []
    const shapeView = this.deps.views.getShapeNode(shapeNodeId)
    // ShapeNodeView has no isActive flag (unlike Node/Edge/Group). Checking
    // `isActive === true` always failed, so only the tiny group band was dirtied
    // and the filled body left a root-layer ghost while the overlay moved.
    if (shapeView !== undefined && shapeView.points.length >= 2) {
      const selected = this.deps.scene.selectedIds.has(shapeNodeId)
      const paint = shapeView.toPaintView(selected, false)
      rects.push(growRect(shapeView.bounds, elementPaintPad({
        selected,
        glow: paint.selectStyle?.glow,
        glowBlur: paint.selectStyle?.glowBlur,
      })))
    }
    for (const groupId of listOwningGroupChainForShapeNode(
      this.deps.scene,
      shapeNodeId,
    )) {
      const groupView = this.deps.views.getGroup(groupId)
      if (groupView?.isActive !== true) continue
      const selected = this.deps.scene.selectedIds.has(groupId)
      const paint = groupView.toPaintView(selected, false)
      rects.push(growRect(groupView.bounds, elementPaintPad({
        shadowBlur: paint.shadow?.blur,
        shadowOffsetY: paint.shadow?.offsetY,
        selected,
        glow: paint.selectStyle?.glow,
        glowBlur: paint.selectStyle?.glowBlur,
      })))
    }
    return rects
  }
}

/** Clone path style into a patch-friendly (mutable dash) object. */
function clonePathStyle(
  style: NonNullable<GraphPath['style']>,
): Extract<GraphPatch['ops'][number], { op: 'addPath' }>['path']['style'] {
  return {
    ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style.lineWidth !== undefined ? { lineWidth: style.lineWidth } : {}),
    ...(style.strokeDash !== undefined ? { strokeDash: [...style.strokeDash] } : {}),
    ...(style.alpha !== undefined ? { alpha: style.alpha } : {}),
    ...(style.shapeKind !== undefined ? { shapeKind: style.shapeKind } : {}),
    ...(style.fill !== undefined ? { fill: style.fill } : {}),
    ...(style.label !== undefined ? { label: { ...style.label } } : {}),
    ...(style.select !== undefined ? { select: { ...style.select } } : {}),
    ...(style.hover !== undefined ? { hover: { ...style.hover } } : {}),
  }
}

/** Clone shape-node style into a patch-friendly object. */
function cloneShapeNodeStyle(
  style: NonNullable<GraphShapeNode['style']>,
): Extract<GraphPatch['ops'][number], { op: 'addShapeNode' }>['shapeNode']['style'] {
  return {
    ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style.lineWidth !== undefined ? { lineWidth: style.lineWidth } : {}),
    ...(style.strokeDash !== undefined ? { strokeDash: [...style.strokeDash] } : {}),
    ...(style.alpha !== undefined ? { alpha: style.alpha } : {}),
    ...(style.shapeKind !== undefined ? { shapeKind: style.shapeKind } : {}),
    ...(style.fill !== undefined ? { fill: style.fill } : {}),
    ...(style.label !== undefined ? { label: { ...style.label } } : {}),
    ...(style.select !== undefined ? { select: { ...style.select } } : {}),
    ...(style.hover !== undefined ? { hover: { ...style.hover } } : {}),
  }
}

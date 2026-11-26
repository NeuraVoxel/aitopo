/**
 * Interaction plugin contract (avoids importing Network class).
 *
 * Wave H: `InteractionHost` is the intersection of hit / camera / query / chrome /
 * edit / bus facets. Runtime still binds one Network object; facets document ownership.
 */

import type { Point, Rect } from '../geom.ts'
import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import type {
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPath,
  GraphShapeNode,
} from '../protocol/types.ts'
import type { Renderer } from '../render/canvas2d.ts'

/**
 * Hit-test element kind.
 * Pick order (top → bottom): node → shapeNode → edge → group → path.
 */
export type HitKind = 'node' | 'shapeNode' | 'edge' | 'group' | 'path'

/** Live rubber-band while creating an edge. */
export interface EdgeRubberBand {
  readonly from: Point
  readonly to: Point
}

/**
 * Transient overlay paint contributed by an interaction (marquee, rubber-band, ghosts).
 * Invoked after scene + selection paint each frame while registered.
 */
export interface OverlayChrome {
  /**
   * Paint overlay chrome for the current frame.
   * @param renderer - paint backend (overlay methods).
   */
  paint(renderer: Renderer): void
}

/** DOM + hit-test surface. */
export interface InteractionHitHost {
  getViewElement(): HTMLDivElement | null
  getHitElement(): HTMLCanvasElement | null
  hitTestScreen(screenX: number, screenY: number): { id: string; kind: HitKind } | undefined
  /**
   * Hit-test groups at a screen point.
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns topmost / smallest-area group id, or undefined.
   */
  hitTestGroupScreen(screenX: number, screenY: number): string | undefined
  /**
   * @param screenX - CSS x relative to the hit canvas.
   * @param screenY - CSS y relative to the hit canvas.
   * @returns world point.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number }
}

/** Selection / hover / activate. */
export interface InteractionSelectionHost {
  setSelection(ids: readonly string[]): void
  setHover(id: string | undefined): void
  activateNode(nodeId: string, detail: 'click' | 'dblclick'): void
  /** @returns selected element ids. */
  getSelectedIds(): readonly string[]
}

/** Camera. */
export interface InteractionCameraHost {
  updateCamera(mutate: (viewport: import('../network/viewport.ts').Viewport) => void): void
  readonly viewport: import('../network/viewport.ts').Viewport
}

/** Read-only graph queries. */
export interface InteractionQueryHost {
  /** @param id - node id. @returns node or undefined. */
  getNode(id: string): GraphNode | undefined
  /** @param id - group id. @returns group or undefined. */
  getGroup(id: string): GraphGroup | undefined
  /** @returns nodes in the active network. */
  getNodes(): readonly GraphNode[]
  /** @returns edges in the active network. */
  getEdges(): readonly GraphEdge[]
  /** @returns groups in the active network. */
  getGroups(): readonly GraphGroup[]
  /** @returns freestanding paths in the active network. */
  getPaths(): readonly GraphPath[]
  /** @returns shape nodes in the active network. */
  getShapeNodes(): readonly GraphShapeNode[]
  /**
   * Validated band / collapsed-body bounds of a group (auto-fit aware).
   * @param id - group id.
   * @returns world rect, or undefined when the group is inactive.
   */
  getGroupBandBounds(id: string): Rect | undefined
  /**
   * Validated edge path AABB (route + pad) for marquee / bend chrome.
   * @param id - edge id.
   * @returns world rect, or undefined when the edge is inactive.
   */
  getEdgePathBounds(id: string): Rect | undefined
  /**
   * Validated freestanding path AABB for marquee / dirty-rect.
   * @param id - path id.
   * @returns world rect, or undefined when missing.
   */
  getPathBounds(id: string): Rect | undefined
  /**
   * Validated shape-node AABB for marquee / dirty-rect.
   * @param id - shape-node id.
   * @returns world rect, or undefined when missing.
   */
  getShapeNodeBounds(id: string): Rect | undefined
}

/** Overlay chrome schedule (Wave E / H registry). */
export interface InteractionChromeHost {
  /**
   * Register transient overlay paint; disposer removes it and requests a repaint.
   * @param chrome - painter invoked each validate after scene paint.
   * @returns disposer.
   */
  addOverlayChrome(chrome: OverlayChrome): () => void
  /**
   * Schedule overlay clear + selection/hover/chrome paint.
   * Does not clear or redraw the root canvas.
   */
  requestOverlayPaint(): void
  /**
   * Alias of {@link InteractionChromeHost.requestOverlayPaint} for chrome-era call sites.
   * Prefer `requestOverlayPaint` in new code.
   */
  requestPaint(): void
}

/** Preview / commit / drag filter (Wave H GestureEditor). */
export interface InteractionEditHost {
  /** Live preview during drag (does not emit nodeMoved). */
  previewNodePosition(id: string, x: number, y: number): void
  /**
   * Live preview bounds during resize (does not emit nodeResized).
   * @param id - node id.
   * @param bounds - world x/y/w/h.
   */
  previewNodeBounds(
    id: string,
    bounds: { x: number; y: number; w: number; h: number },
  ): void
  /**
   * Commit move: apply updateNode, optional membership patch, emit nodeMoved
   * and groupMembershipChanged when membership changes.
   *
   * `toGroupId` sentinel (presence vs value):
   * - property omitted → membership unchanged
   * - `toGroupId: undefined` (key present) → clear membership
   * - `toGroupId: 'g…'` → reparent into that group
   */
  commitNodeMove(args: {
    nodeId: string
    from: { x: number; y: number }
    to: { x: number; y: number }
    toGroupId?: string | undefined
  }): void
  /**
   * Live preview of a group drag: translate group x/y and all member nodes.
   * @param groupId - group id.
   * @param dx - world delta x from drag start.
   * @param dy - world delta y from drag start.
   * @param origins - drag-start positions for group and members.
   */
  previewGroupMove(args: {
    groupId: string
    dx: number
    dy: number
    groupFrom: { x: number; y: number }
    members: readonly { id: string; fromX: number; fromY: number }[]
    childGroups?: readonly { id: string; fromX: number; fromY: number }[]
  }): void
  /**
   * Commit a group drag: updateGroup x/y + updateNode for each member.
   * @param args - group and member from/to positions.
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
  }): void
  /**
   * Toggle a group's `expanded` flag (double-click; skipped when locked).
   * @param groupId - group id.
   */
  toggleGroupExpanded(groupId: string): void
  /**
   * Commit resize: apply updateNode x/y/w/h, emit nodeResized.
   * @param args - from/to bounds.
   */
  commitNodeResize(args: {
    nodeId: string
    from: { x: number; y: number; w: number; h: number }
    to: { x: number; y: number; w: number; h: number }
  }): void
  /**
   * Commit a new directed edge: apply `addEdge`, emit `edgeCreated`.
   * @param args - endpoints (node or group ids) and optional kind / id.
   * @returns created edge id, or undefined when skipped (missing endpoint / duplicate).
   */
  commitEdgeCreate(args: {
    from: string
    to: string
    kind?: string
    id?: string
  }): string | undefined
  /**
   * Remove edges by id: apply `removeEdge` ops, emit `edgeRemoved` per id.
   * @param edgeIds - edge ids to remove.
   */
  commitEdgeRemove(edgeIds: readonly string[]): void
  /** Mark that a drag consumed this pointer gesture (SelectActivate skips activate). */
  markGestureDragged(): void
  /** @returns true when markGestureDragged ran since the last clear. */
  wasGestureDragged(): boolean
  /** Reset the drag-consumed flag (call at pointerdown). */
  clearGestureDragged(): void
  /**
   * Restrict paint to the given node ids (plus incident edges) during drag.
   * Pass `undefined` to paint the full scene (default).
   * @param nodeIds - mover ids to keep visible, or undefined to clear.
   */
  setDragPaintFilter(nodeIds: readonly string[] | undefined): void
  /** Live preview of edge bend waypoints (does not emit edgeWaypointsChanged). */
  previewEdgeWaypoints(
    edgeId: string,
    waypoints: readonly { readonly x: number; readonly y: number }[],
  ): void
  /**
   * Live preview of path control points (does not emit pathUpdated).
   * @param pathId - path id.
   * @param points - control points.
   */
  previewPathPoints(
    pathId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void
  /**
   * Live preview of shape-node control points (does not emit shapeNodeUpdated).
   * @param shapeNodeId - shape-node id.
   * @param points - control points.
   */
  previewShapeNodePoints(
    shapeNodeId: string,
    points: readonly { readonly x: number; readonly y: number }[],
  ): void
  /**
   * Commit edge bend waypoints via updateEdge; emit edgeWaypointsChanged.
   * @param args - edge id and from/to waypoint lists.
   */
  commitEdgeWaypoints(args: {
    edgeId: string
    from: readonly { readonly x: number; readonly y: number }[]
    to: readonly { readonly x: number; readonly y: number }[]
  }): void
  /**
   * Commit a new freestanding path: apply `addPath`, emit `pathCreated`.
   * @param args - control points and optional style / id / closed.
   * @returns created path id, or undefined when skipped.
   */
  commitPathCreate(args: {
    points: readonly { readonly x: number; readonly y: number }[]
    closed?: boolean
    style?: GraphPath['style']
    label?: string
    id?: string
  }): string | undefined
  /**
   * Commit a path update: apply `updatePath`, emit `pathUpdated`.
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
  }): void
  /**
   * Remove paths by id: apply `removePath` ops, emit `pathRemoved` per id.
   * @param pathIds - path ids to remove.
   */
  commitPathRemove(pathIds: readonly string[]): void
  /**
   * Commit a new shape node: apply `addShapeNode`, emit `shapeNodeCreated`.
   * @param args - control points and optional style / id / closed.
   * @returns created shape-node id, or undefined when skipped.
   */
  commitShapeNodeCreate(args: {
    points: readonly { readonly x: number; readonly y: number }[]
    closed?: boolean
    style?: GraphShapeNode['style']
    label?: string
    id?: string
  }): string | undefined
  /**
   * Commit a shape-node update: apply `updateShapeNode`, emit `shapeNodeUpdated`.
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
  }): void
  /**
   * Remove shape nodes by id: apply `removeShapeNode` ops, emit `shapeNodeRemoved` per id.
   * @param shapeNodeIds - shape-node ids to remove.
   */
  commitShapeNodeRemove(shapeNodeIds: readonly string[]): void
  /**
   * Live preview of element angle (does not emit a dedicated angle event).
   * @param args - kind, id, degrees.
   */
  previewElementAngle(args: {
    kind: 'node' | 'group' | 'path' | 'shapeNode'
    id: string
    angle: number
  }): void
  /**
   * Commit element angle via update* patch.
   * @param args - kind, id, from/to degrees.
   */
  commitElementAngle(args: {
    kind: 'node' | 'group' | 'path' | 'shapeNode'
    id: string
    from: number
    to: number
  }): void
}

/** Event bus + patch apply. */
export interface InteractionBusHost {
  /**
   * Fan out a GraphEvent to subscribers.
   * @param event - event payload.
   */
  emit(event: GraphEvent): void
  /**
   * Apply a GraphPatch atomically.
   * @param patch - patch object with `ops`.
   */
  apply(patch: GraphPatch): void
}

/** Sub-network navigation. */
export interface InteractionNavigationHost {
  /**
   * Enter a child of the current document (`networks[id]`); stack may nest.
   * @param id - sub-network id under the active document.
   */
  enterSubNetwork(id: string): void
  /** Pop one SubNetwork level (child → parent, or parent → root). */
  exitSubNetwork(): void
  /** Active sub-network id (stack tip), or null at the root network. */
  readonly currentNetworkId: string | null
}

/**
 * Full host surface interactions bind to (Network implements all facets).
 */
export type InteractionHost =
  & InteractionHitHost
  & InteractionSelectionHost
  & InteractionCameraHost
  & InteractionQueryHost
  & InteractionChromeHost
  & InteractionEditHost
  & InteractionBusHost
  & InteractionNavigationHost

/** Pluggable pointer / wheel behavior. */
export interface Interaction {
  /**
   * Attach listeners to the network view.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void
}

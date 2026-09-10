/**
 * Interaction plugin contract (avoids importing Network class).
 */

import type { Point } from '../geom.ts'
import type { GraphEvent } from '../protocol/events.ts'
import type { GraphPatch } from '../protocol/patch.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'
import type { Renderer } from '../render/canvas2d.ts'

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

/** Minimal host surface interactions bind to. */
export interface InteractionHost {
  getViewElement(): HTMLDivElement | null
  getHitElement(): HTMLCanvasElement | null
  hitTestScreen(screenX: number, screenY: number): { id: string; kind: 'node' | 'edge' } | undefined
  setSelection(ids: readonly string[]): void
  setHover(id: string | undefined): void
  activateNode(nodeId: string, detail: 'click' | 'dblclick'): void
  updateCamera(mutate: (viewport: import('../network/viewport.ts').Viewport) => void): void
  readonly viewport: import('../network/viewport.ts').Viewport
  /** @param id - node id. @returns node or undefined. */
  getNode(id: string): GraphNode | undefined
  /** @returns nodes in the active network. */
  getNodes(): readonly GraphNode[]
  /** @returns edges in the active network. */
  getEdges(): readonly GraphEdge[]
  /** @returns groups in the active network. */
  getGroups(): readonly GraphGroup[]
  /** @returns selected element ids. */
  getSelectedIds(): readonly string[]
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
  /** Live preview during drag (does not emit nodeMoved). */
  previewNodePosition(id: string, x: number, y: number): void
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
   * Commit a new directed edge: apply `addEdge`, emit `edgeCreated`.
   * @param args - endpoints and optional kind / id.
   * @returns created edge id, or undefined when skipped (missing node / duplicate).
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
   * Register transient overlay paint; disposer removes it and requests a repaint.
   * @param chrome - painter invoked each validate after scene paint.
   * @returns disposer.
   */
  addOverlayChrome(chrome: OverlayChrome): () => void
  /** Schedule a full-frame repaint (chrome state changed without a scene mutation). */
  requestPaint(): void
  /**
   * Restrict paint to the given node ids (plus incident edges) during drag.
   * Pass `undefined` to paint the full scene (default).
   * @param nodeIds - mover ids to keep visible, or undefined to clear.
   */
  setDragPaintFilter(nodeIds: readonly string[] | undefined): void
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

/** Pluggable pointer / wheel behavior. */
export interface Interaction {
  /**
   * Attach listeners to the network view.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void
}

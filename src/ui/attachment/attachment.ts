/**
 * Base class for View-layer attachments (node or edge hosts; not protocol objects).
 */

import { hitRect, type Point, type Rect } from '../../geom.ts'
import type { GraphEdge, GraphNode } from '../../protocol/types.ts'
import type { AttachmentPaintOp } from './types.ts'

/** Validate inputs when the host is a node body. */
export interface NodeAttachmentValidateCtx {
  readonly node: GraphNode
  readonly body: Rect
}

/** Validate inputs when the host is an edge polyline. */
export interface EdgeAttachmentValidateCtx {
  readonly edge: GraphEdge
  readonly points: readonly Point[]
}

/** Inputs shared by attachment validate (node or edge). */
export type AttachmentValidateCtx = NodeAttachmentValidateCtx | EdgeAttachmentValidateCtx

/** @param ctx - validate context. */
export function isNodeAttachmentCtx(ctx: AttachmentValidateCtx): ctx is NodeAttachmentValidateCtx {
  return 'node' in ctx
}

/** @param ctx - validate context. */
export function isEdgeAttachmentCtx(ctx: AttachmentValidateCtx): ctx is EdgeAttachmentValidateCtx {
  return 'edge' in ctx
}

/**
 * Lean attachment: validate bounds, emit a paint op, optional rect hit.
 */
export abstract class Attachment {
  protected cachedBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }

  /** World bounds after the last validate. */
  get bounds(): Rect {
    return this.cachedBounds
  }

  /**
   * Whether this attachment joins `unionBounds` / host dirty geometry.
   * Hover-only tooltips return false.
   */
  contributesToUnion(): boolean {
    return true
  }

  /**
   * Recompute `bounds` from the live host.
   * @param ctx - validate context.
   */
  abstract validate(ctx: AttachmentValidateCtx): void

  /**
   * Build a paint DTO for the current validated state.
   * @param hovered - whether the host element is hovered (tooltip hover mode).
   */
  abstract toPaintOp(hovered: boolean): AttachmentPaintOp | undefined

  /**
   * Hit-test in world space.
   * @param point - world point.
   */
  hit(point: Point): boolean {
    return hitRect(point, this.cachedBounds)
  }
}

/**
 * Base class for View-layer attachments (node, edge, or group hosts; not protocol objects).
 */

import { hitRect, type Point, type Rect } from '../../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../../protocol/types.ts'
import type { AttachmentPaintOp } from './types.ts'

/** Validate inputs when the host is a node body. */
export interface NodeAttachmentValidateCtx {
  readonly node: GraphNode
  readonly body: Rect
}

/** Validate inputs when the host is a group band body. */
export interface GroupAttachmentValidateCtx {
  readonly group: GraphGroup
  readonly body: Rect
}

/** Validate inputs when the host is an edge polyline. */
export interface EdgeAttachmentValidateCtx {
  readonly edge: GraphEdge
  readonly points: readonly Point[]
}

/** Inputs shared by attachment validate (node, group, or edge). */
export type AttachmentValidateCtx =
  | NodeAttachmentValidateCtx
  | GroupAttachmentValidateCtx
  | EdgeAttachmentValidateCtx

/** Box host (node or group) for shared label/alarm/tooltip placement. */
export type BoxAttachmentValidateCtx = NodeAttachmentValidateCtx | GroupAttachmentValidateCtx

/** @param ctx - validate context. */
export function isNodeAttachmentCtx(ctx: AttachmentValidateCtx): ctx is NodeAttachmentValidateCtx {
  return 'node' in ctx
}

/** @param ctx - validate context. */
export function isGroupAttachmentCtx(ctx: AttachmentValidateCtx): ctx is GroupAttachmentValidateCtx {
  return 'group' in ctx
}

/** @param ctx - validate context. */
export function isEdgeAttachmentCtx(ctx: AttachmentValidateCtx): ctx is EdgeAttachmentValidateCtx {
  return 'edge' in ctx
}

/** @param ctx - validate context. */
export function isBoxAttachmentCtx(ctx: AttachmentValidateCtx): ctx is BoxAttachmentValidateCtx {
  return isNodeAttachmentCtx(ctx) || isGroupAttachmentCtx(ctx)
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

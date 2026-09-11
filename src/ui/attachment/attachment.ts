/**
 * Base class for node-side attachments (View layer; not protocol objects).
 */

import { hitRect, type Point, type Rect } from '../../geom.ts'
import type { GraphNode } from '../../protocol/types.ts'
import type { AttachmentPaintOp } from './types.ts'

/** Inputs shared by every attachment validate. */
export interface AttachmentValidateCtx {
  readonly node: GraphNode
  readonly body: Rect
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
   * Whether this attachment joins `unionBounds` / node hit.
   * Hover-only tooltips return false.
   */
  contributesToUnion(): boolean {
    return true
  }

  /**
   * Recompute `bounds` from the live node and body.
   * @param ctx - validate context.
   */
  abstract validate(ctx: AttachmentValidateCtx): void

  /**
   * Build a paint DTO for the current validated state.
   * @param hovered - whether the host node is hovered (tooltip hover mode).
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

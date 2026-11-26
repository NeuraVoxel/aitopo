/**
 * Registered vector body images for GraphNode (clean-room stand-in for
 * twaver Node image + function/vector ImageAsset — no twaver API names).
 *
 * Draw receives the node so hosts can bind length / phase / state from
 * `data` and `style.vectorImageState`. Full declarative state/animate DSL
 * is deferred; hosts animate by patching those fields.
 */

import type { GraphNode } from '../protocol/types.ts'
import type { Rect } from '../geom.ts'

/** Binding bag passed into a vector-image drawer. */
export interface VectorImagePaintCtx {
  readonly node: GraphNode
  /** `style.vectorImageState`; omitted when unset. */
  readonly state: string | undefined
  /**
   * Animation phase in `[0, 1)` when `data.vectorImagePhase` is a finite number;
   * otherwise undefined.
   */
  readonly phase: number | undefined
}

/** Drawable vector body image (paints in unrotated body space; caller rotates). */
export interface VectorImageDefinition {
  readonly key: string
  /**
   * Paint into the node body.
   * @param ctx - 2d context (already rotated about the node pivot when angled).
   * @param body - unrotated body bounds.
   * @param paintCtx - node + state/phase bindings.
   */
  readonly draw: (
    ctx: CanvasRenderingContext2D,
    body: Rect,
    paintCtx: VectorImagePaintCtx,
  ) => void
  /**
   * Unrotated AABB of ink that may extend past `body` (dirty / cull union).
   * Omitted → NodeView unions body only for this overlay (risk of drag residuals
   * when drawing outside the box).
   */
  readonly bounds?: (
    body: Rect,
    paintCtx: VectorImagePaintCtx,
  ) => Rect
}

const images = new Map<string, VectorImageDefinition>()

/**
 * Register or replace a vector body image.
 * @param definition - image to store.
 */
export function registerVectorImage(definition: VectorImageDefinition): void {
  images.set(definition.key, definition)
}

/**
 * Resolve a vector image key; unknown / omitted → undefined (no body overlay).
 * @param key - registry key.
 */
export function getVectorImage(key: string | undefined): VectorImageDefinition | undefined {
  if (key === undefined) return undefined
  return images.get(key)
}

/**
 * Build paint bindings from a node document.
 * @param node - current node.
 */
export function vectorImagePaintCtx(node: GraphNode): VectorImagePaintCtx {
  const rawPhase = node.data?.vectorImagePhase
  let phase: number | undefined
  if (typeof rawPhase === 'number' && Number.isFinite(rawPhase)) {
    // Keep values already in [0, 1) exact; wrap others into that range.
    phase = rawPhase >= 0 && rawPhase < 1
      ? rawPhase
      : ((rawPhase % 1) + 1) % 1
  }
  return {
    node,
    state: node.style?.vectorImageState,
    phase,
  }
}

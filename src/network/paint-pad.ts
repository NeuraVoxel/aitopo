/**
 * Paint-extent grow for View bounds (twaver-style appendShadowBound / glow).
 * Dirty capture uses baked `view.paintBounds` plus a final Network AA grow(2).
 */

import type { GraphShadowStyle } from '../protocol/types.ts'

/** Default selection glow blur (`GraphChromeStyle.glowBlur` when omitted). */
export const DEFAULT_GLOW_BLUR = 16

/** Node drop shadow when `style.shadow` is omitted (Canvas + paint extent). */
export const DEFAULT_NODE_SHADOW: GraphShadowStyle = {
  color: 'rgba(0, 0, 0, 0.35)',
  blur: 6,
  offsetX: 0,
  offsetY: 2,
}

/** Extra world-px around shadow blur+offsets (Canvas soft edge). */
export const PAINT_SHADOW_EXTENT_PAD = 2

/** Extra world-px around selection glow blur. */
export const PAINT_GLOW_EXTENT_PAD = 4

/** twaver Network final dirty slop after unioning viewRects. */
export const DIRTY_SEED_AA_GROW = 2

/**
 * World-px grow for shadow / optional selection glow (no minimum floor).
 * Bake into View.paintBounds at validate; do not re-apply at dirty capture sites.
 * @param args - resolved paint shadow and optional glow.
 */
export function paintExtentGrow(args: {
  readonly shadowBlur?: number | undefined
  readonly shadowOffsetX?: number | undefined
  readonly shadowOffsetY?: number | undefined
  readonly includeGlow?: boolean | undefined
  readonly glow?: boolean | undefined
  readonly glowBlur?: number | undefined
  /** Override {@link PAINT_SHADOW_EXTENT_PAD} (tests / tooling). */
  readonly shadowExtentPad?: number | undefined
  /** Override {@link PAINT_GLOW_EXTENT_PAD} (tests / tooling). */
  readonly glowExtentPad?: number | undefined
} = {}): number {
  const hasShadow =
    args.shadowBlur !== undefined
    || args.shadowOffsetX !== undefined
    || args.shadowOffsetY !== undefined
  const shadowPad = args.shadowExtentPad ?? PAINT_SHADOW_EXTENT_PAD
  const shadow = hasShadow
    ? (args.shadowBlur ?? 0)
      + Math.abs(args.shadowOffsetX ?? 0)
      + Math.abs(args.shadowOffsetY ?? 0)
      + shadowPad
    : 0
  const glowOn = args.includeGlow === true && (args.glow ?? true)
  const glowPad = args.glowExtentPad ?? PAINT_GLOW_EXTENT_PAD
  const glow = glowOn ? (args.glowBlur ?? DEFAULT_GLOW_BLUR) + glowPad : 0
  return Math.max(0, shadow, glow)
}

/**
 * Legacy dirty pad with a minimum of 8. Prefer baking via {@link paintExtentGrow}
 * into View.paintBounds; kept for any remaining call sites during migration.
 * @param args - optional live shadow / selection chrome.
 */
export function elementPaintPad(args: {
  readonly shadowBlur?: number | undefined
  readonly shadowOffsetX?: number | undefined
  readonly shadowOffsetY?: number | undefined
  readonly selected?: boolean | undefined
  readonly glow?: boolean | undefined
  readonly glowBlur?: number | undefined
} = {}): number {
  return Math.max(8, paintExtentGrow({
    shadowBlur: args.shadowBlur,
    shadowOffsetX: args.shadowOffsetX,
    shadowOffsetY: args.shadowOffsetY,
    includeGlow: args.selected === true,
    glow: args.glow,
    glowBlur: args.glowBlur,
  }))
}

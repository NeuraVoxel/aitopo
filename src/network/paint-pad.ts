/**
 * Dirty-rect padding so root paint extents (drop shadow / selection glow)
 * clear and redraw with the element instead of leaving seam residuals.
 */

/** Default drop-shadow blur used when style.shadow is omitted. */
const DEFAULT_SHADOW_BLUR = 6
/** Default drop-shadow Y offset used when style.shadow is omitted. */
const DEFAULT_SHADOW_OFFSET_Y = 2
/** Default selection glow blur (`GraphChromeStyle.glowBlur`). */
const DEFAULT_GLOW_BLUR = 16

/**
 * World-px grow for a node/group dirty rect.
 * @param args - optional live shadow / selection chrome.
 */
export function elementPaintPad(args: {
  readonly shadowBlur?: number
  readonly shadowOffsetY?: number
  readonly selected?: boolean
  readonly glow?: boolean
  readonly glowBlur?: number
} = {}): number {
  const shadow =
    (args.shadowBlur ?? DEFAULT_SHADOW_BLUR)
    + Math.abs(args.shadowOffsetY ?? DEFAULT_SHADOW_OFFSET_Y)
    + 2
  const glowOn = args.selected === true && (args.glow ?? true)
  const glow = glowOn ? (args.glowBlur ?? DEFAULT_GLOW_BLUR) + 4 : 0
  return Math.max(8, shadow, glow)
}

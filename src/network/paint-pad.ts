/**
 * Dirty-rect padding so root paint extents (drop shadow / selection glow)
 * clear and redraw with the element instead of leaving seam residuals.
 */

/** Default selection glow blur (`GraphChromeStyle.glowBlur`). */
const DEFAULT_GLOW_BLUR = 16

/**
 * World-px grow for a node/group dirty rect.
 * Pass live `shadowBlur` / `shadowOffsetY` from the paint DTO when a drop
 * shadow is active. Omitted shadow args mean no drop shadow (pad from glow /
 * minimum only) — callers must forward the resolved paint shadow, including
 * the node default soft shadow when it applies.
 * @param args - optional live shadow / selection chrome.
 */
export function elementPaintPad(args: {
  readonly shadowBlur?: number | undefined
  readonly shadowOffsetY?: number | undefined
  readonly selected?: boolean | undefined
  readonly glow?: boolean | undefined
  readonly glowBlur?: number | undefined
} = {}): number {
  const hasShadow = args.shadowBlur !== undefined || args.shadowOffsetY !== undefined
  const shadow = hasShadow
    ? (args.shadowBlur ?? 0) + Math.abs(args.shadowOffsetY ?? 0) + 2
    : 0
  const glowOn = args.selected === true && (args.glow ?? true)
  const glow = glowOn ? (args.glowBlur ?? DEFAULT_GLOW_BLUR) + 4 : 0
  return Math.max(8, shadow, glow)
}

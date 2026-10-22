/**
 * Place an attachment content box relative to the node body.
 */

import type { Rect } from '../../geom.ts'
import type { AttachmentPosition } from '../../protocol/types.ts'

const DEFAULT_GAP = 4
/** Inset from the body edge for `insideTop*` positions (old in-body group title). */
const DEFAULT_INSET = 8
/** Bottom inset for `insideBottom` — tighter to a centered title (card subtitle). */
const INSIDE_BOTTOM_INSET = 16

/**
 * Axis-aligned box for attachment content at a fixed position around/inside body.
 * @param body - node body bounds.
 * @param position - anchor enum.
 * @param width - content width.
 * @param height - content height.
 * @param gap - gap outside the body (ignored for `center` and `inside*`).
 */
export function placeAttachment(
  body: Rect,
  position: AttachmentPosition,
  width: number,
  height: number,
  gap = DEFAULT_GAP,
): Rect {
  const cx = body.x + body.width / 2
  const cy = body.y + body.height / 2
  const inset = DEFAULT_INSET
  switch (position) {
    case 'center':
      return {
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
      }
    case 'top':
      return {
        x: cx - width / 2,
        y: body.y - gap - height,
        width,
        height,
      }
    case 'bottom':
      return {
        x: cx - width / 2,
        y: body.y + body.height + gap,
        width,
        height,
      }
    case 'left':
      return {
        x: body.x - gap - width,
        y: cy - height / 2,
        width,
        height,
      }
    case 'right':
      return {
        x: body.x + body.width + gap,
        y: cy - height / 2,
        width,
        height,
      }
    case 'topLeft':
      return {
        x: body.x - gap,
        y: body.y - gap - height,
        width,
        height,
      }
    case 'topRight':
      return {
        x: body.x + body.width - width + gap,
        y: body.y - gap,
        width,
        height,
      }
    case 'bottomLeft':
      return {
        x: body.x - gap,
        y: body.y + body.height + gap,
        width,
        height,
      }
    case 'bottomRight':
      return {
        x: body.x + body.width - width + gap,
        y: body.y + body.height + gap,
        width,
        height,
      }
    case 'insideTop':
      return {
        x: cx - width / 2,
        y: body.y + inset,
        width,
        height,
      }
    case 'insideTopLeft':
      return {
        x: body.x + inset,
        y: body.y + inset,
        width,
        height,
      }
    case 'insideTopRight':
      return {
        x: body.x + body.width - width - inset,
        y: body.y + inset,
        width,
        height,
      }
    case 'insideBottom':
      return {
        x: cx - width / 2,
        y: body.y + body.height - INSIDE_BOTTOM_INSET - height,
        width,
        height,
      }
    default: {
      const _exhaustive: never = position
      throw new Error(`unhandled attachment position: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Place a tooltip relative to a node/group body.
 * Default `topRight`: tooltip **bottom-left** meets body **top-right** (flush).
 * Other positions reuse {@link placeAttachment}.
 */
export function placeTooltip(
  body: Rect,
  position: AttachmentPosition,
  width: number,
  height: number,
): Rect {
  if (position === 'topRight') {
    return {
      x: body.x + body.width,
      y: body.y - height,
      width,
      height,
    }
  }
  return placeAttachment(body, position, width, height)
}

/**
 * Approximate text size without a canvas context (wide glyphs ~1.05em, Latin ~0.6em).
 * @param text - string to measure.
 * @param fontSize - px.
 * @param fontWeight - optional weight; bold uses a slightly wider advance.
 */
export function estimateTextSize(
  text: string,
  fontSize: number,
  fontWeight: 'normal' | 'bold' = 'normal',
): { width: number; height: number } {
  const width = Math.max(1, estimateTextWidth(text, fontSize, fontWeight))
  return { width, height: fontSize * 1.2 }
}

/**
 * Approximate advance width. CJK / fullwidth glyphs use ~1em; Latin uses ~0.55–0.6em.
 * @param text - string to measure.
 * @param fontSize - px.
 * @param fontWeight - optional weight; bold slightly wider for Latin.
 */
export function estimateTextWidth(
  text: string,
  fontSize: number,
  fontWeight: 'normal' | 'bold' = 'normal',
): number {
  // Slightly conservative vs typical canvas `sans-serif` so backgrounds
  // and wrap breaks do not undershoot painted glyphs.
  const latin = fontWeight === 'bold' ? 0.7 : 0.6
  const wide = fontSize * 1.05
  let w = 0
  for (const ch of text) {
    w += isWideGlyph(ch) ? wide : fontSize * latin
  }
  return w
}

/**
 * Wrap text to a max pixel width (honors explicit `\n`). Used by tooltips so
 * long CJK strings do not overflow the background.
 * @param text - source string.
 * @param fontSize - px.
 * @param maxWidth - content width before padding.
 * @param fontWeight - optional weight.
 */
export function layoutWrappedText(
  text: string,
  fontSize: number,
  maxWidth: number,
  fontWeight: 'normal' | 'bold' = 'normal',
): { readonly lines: readonly string[]; readonly width: number; readonly height: number } {
  const lineHeight = fontSize * 1.25
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const ch of paragraph) {
      const next = current + ch
      if (current.length > 0 && estimateTextWidth(next, fontSize, fontWeight) > maxWidth) {
        lines.push(current)
        current = ch
      } else {
        current = next
      }
    }
    if (current.length > 0) lines.push(current)
  }
  if (lines.length === 0) lines.push('')
  let width = 1
  for (const line of lines) {
    width = Math.max(width, estimateTextWidth(line, fontSize, fontWeight))
  }
  return {
    lines,
    width,
    height: Math.max(lineHeight, lines.length * lineHeight),
  }
}

function isWideGlyph(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  // CJK + fullwidth forms + Hangul / kana blocks commonly drawn ~1em wide.
  return (
    (code >= 0x1100 && code <= 0x11ff)
    || (code >= 0x2e80 && code <= 0x9fff)
    || (code >= 0xac00 && code <= 0xd7af)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe30 && code <= 0xfe4f)
    || (code >= 0xff01 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6)
    || (code >= 0x20000 && code <= 0x2fa1f)
  )
}

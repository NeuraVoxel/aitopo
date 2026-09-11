/**
 * Place an attachment content box relative to the node body.
 */

import type { Rect } from '../../geom.ts'
import type { AttachmentPosition } from '../../protocol/types.ts'

const DEFAULT_GAP = 4

/**
 * Axis-aligned box for attachment content at a fixed position around/inside body.
 * @param body - node body bounds.
 * @param position - anchor enum.
 * @param width - content width.
 * @param height - content height.
 * @param gap - gap outside the body (ignored for `center`).
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
    default: {
      const _exhaustive: never = position
      throw new Error(`unhandled attachment position: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Approximate text size without a canvas context (0.6em average advance).
 * @param text - string to measure.
 * @param fontSize - px.
 */
export function estimateTextSize(text: string, fontSize: number): { width: number; height: number } {
  const width = Math.max(1, text.length * fontSize * 0.6)
  return { width, height: fontSize * 1.2 }
}

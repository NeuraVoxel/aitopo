/**
 * Alarm badge attachment (default: top-right of body).
 *
 * When `Alarm.message` is a short badge string (e.g. a Turn count), it is
 * painted centered in the circle. Severity fills stay warm on dark canvases.
 */

import type { AlarmLevel, AttachmentPosition } from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const BASE_RADIUS = 7
const MAX_BADGE_CHARS = 3

/** AlarmAttachment — highest-severity alarm badge on node or group. */
export class AlarmAttachment extends Attachment {
  private level: AlarmLevel = 'info'
  private position: AttachmentPosition = 'topRight'
  private text = ''
  private radius = BASE_RADIUS

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const alarms = isGroupAttachmentCtx(ctx) ? ctx.group.alarms : ctx.node.alarms
    const alarm = alarms?.find(a => a.level === 'error') ?? alarms?.[0]
    if (alarm === undefined) {
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.text = ''
      return
    }
    this.level = alarm.level
    this.text = truncateBadge(alarm.message)
    this.radius = this.text.length >= 2 ? BASE_RADIUS + 2 : BASE_RADIUS
    this.position = 'topRight'
    const diameter = this.radius * 2
    const box = placeAttachment(ctx.body, this.position, diameter, diameter, -this.radius)
    this.cachedBounds = box
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp | undefined {
    if (this.cachedBounds.width <= 0) return undefined
    return {
      kind: 'alarm',
      layer: 'scene',
      bounds: this.cachedBounds,
      level: this.level,
      radius: this.radius,
      ...(this.text.length > 0 ? { text: this.text } : {}),
    }
  }
}

function truncateBadge(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length === 0) return ''
  if (trimmed.length <= MAX_BADGE_CHARS) return trimmed
  return trimmed.slice(0, MAX_BADGE_CHARS)
}

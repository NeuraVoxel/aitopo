/**
 * Alarm badge attachment (default: top-right of body).
 */

import type { AlarmLevel, AttachmentPosition } from '../../protocol/types.ts'
import { Attachment, isNodeAttachmentCtx, type AttachmentValidateCtx } from './attachment.ts'
import { placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const ALARM_RADIUS = 6
const DIAMETER = ALARM_RADIUS * 2

/** AlarmAttachment — highest-severity alarm badge. */
export class AlarmAttachment extends Attachment {
  private level: AlarmLevel = 'info'
  private position: AttachmentPosition = 'topRight'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isNodeAttachmentCtx(ctx)) return
    const alarm = ctx.node.alarms?.find(a => a.level === 'error') ?? ctx.node.alarms?.[0]
    if (alarm === undefined) {
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      return
    }
    this.level = alarm.level
    this.position = 'topRight'
    // Badge centered near the body top-right corner (slightly inset).
    const box = placeAttachment(ctx.body, this.position, DIAMETER, DIAMETER, -ALARM_RADIUS)
    this.cachedBounds = box
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp | undefined {
    if (this.cachedBounds.width <= 0) return undefined
    return {
      kind: 'alarm',
      layer: 'scene',
      bounds: this.cachedBounds,
      level: this.level,
      radius: ALARM_RADIUS,
    }
  }
}

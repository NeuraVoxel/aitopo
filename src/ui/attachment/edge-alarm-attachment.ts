/**
 * Alarm badge on an edge polyline (default near the `to` end).
 */

import type { AlarmLevel } from '../../protocol/types.ts'
import {
  Attachment,
  isEdgeAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { placeAlongPath } from './path.ts'
import type { AttachmentPaintOp } from './types.ts'

const ALARM_RADIUS = 6
const DIAMETER = ALARM_RADIUS * 2

/** EdgeAlarmAttachment — highest-severity alarm badge on the path. */
export class EdgeAlarmAttachment extends Attachment {
  private level: AlarmLevel = 'info'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isEdgeAttachmentCtx(ctx)) return
    const alarm = ctx.edge.alarms?.find(a => a.level === 'error') ?? ctx.edge.alarms?.[0]
    if (alarm === undefined) {
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      return
    }
    this.level = alarm.level
    this.cachedBounds = placeAlongPath(
      ctx.points,
      ctx.edge.style?.alarmAt ?? 0.85,
      DIAMETER,
      DIAMETER,
      0,
    )
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

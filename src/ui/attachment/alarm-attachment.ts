/**
 * Alarm badge attachment (default: filled `dot` at top-right).
 *
 * Skill third-titles opt into `alarmVariant: "tag"` + `alarmPosition: "insideTopLeft"`
 * so short codes (APP / LAKE) render as outline pills inside the body.
 */

import type {
  AlarmLevel,
  AlarmVariant,
  AttachmentPosition,
  GraphTextStyle,
} from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const BASE_RADIUS = 7
const DEFAULT_DOT_MAX_CHARS = 3
const DEFAULT_TAG_MAX_CHARS = 5
const TAG_HEIGHT = 12
const TAG_PAD_X = 6
const TAG_FONT = 7

/** AlarmAttachment — highest-severity alarm badge on node or group. */
export class AlarmAttachment extends Attachment {
  private level: AlarmLevel = 'info'
  private position: AttachmentPosition = 'topRight'
  private variant: AlarmVariant = 'dot'
  private text = ''
  private radius = BASE_RADIUS
  private color: string | undefined
  private fontSize = TAG_FONT

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const host = isGroupAttachmentCtx(ctx) ? ctx.group : ctx.node
    const style = host.style
    const alarms = host.alarms
    const alarm = alarms?.find(a => a.level === 'error') ?? alarms?.[0]
    if (alarm === undefined) {
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.text = ''
      return
    }
    this.level = alarm.level
    this.variant = style?.alarmVariant ?? 'dot'
    this.position = style?.alarmPosition ?? 'topRight'
    this.color = style?.alarm?.color
    this.fontSize = style?.alarm?.fontSize ?? TAG_FONT
    const maxChars = resolveMaxChars(style?.alarm, this.variant)
    this.text = truncateBadge(alarm.message, maxChars)

    if (this.variant === 'tag') {
      const width = Math.max(
        TAG_HEIGHT * 2,
        Math.ceil(this.text.length * this.fontSize * 0.72) + TAG_PAD_X * 2,
      )
      this.radius = 0
      this.cachedBounds = placeAttachment(ctx.body, this.position, width, TAG_HEIGHT)
      return
    }

    this.radius = this.text.length >= 2 ? BASE_RADIUS + 2 : BASE_RADIUS
    const diameter = this.radius * 2
    // Negative gap keeps the demo dot overlapping the top-right corner.
    const gap = this.position === 'topRight' ? -this.radius : undefined
    this.cachedBounds = placeAttachment(
      ctx.body,
      this.position,
      diameter,
      diameter,
      gap,
    )
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp | undefined {
    if (this.cachedBounds.width <= 0) return undefined
    if (this.variant === 'tag') {
      return {
        kind: 'alarm',
        layer: 'scene',
        bounds: this.cachedBounds,
        level: this.level,
        variant: 'tag',
        ...(this.color !== undefined ? { color: this.color } : {}),
        fontSize: this.fontSize,
        ...(this.text.length > 0 ? { text: this.text } : {}),
      }
    }
    return {
      kind: 'alarm',
      layer: 'scene',
      bounds: this.cachedBounds,
      level: this.level,
      variant: 'dot',
      radius: this.radius,
      ...(this.text.length > 0 ? { text: this.text } : {}),
    }
  }
}

function resolveMaxChars(style: GraphTextStyle | undefined, variant: AlarmVariant): number {
  if (style?.maxChars !== undefined) return style.maxChars
  return variant === 'tag' ? DEFAULT_TAG_MAX_CHARS : DEFAULT_DOT_MAX_CHARS
}

function truncateBadge(message: string, maxChars: number): string {
  const trimmed = message.trim()
  if (trimmed.length === 0) return ''
  if (maxChars <= 0 || trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars)
}

/**
 * Primary label attachment (default position: bottom for nodes, top for groups).
 */

import type { AttachmentPosition, GraphTextStyle } from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { estimateTextSize, placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const DEFAULT_COLOR = '#000000'
const DEFAULT_FONT = 12
/**
 * Default maxChars for GraphNode labels when style.maxChars is omitted.
 * `0` = no truncate; opt in per element via `style.label.maxChars`.
 */
const DEFAULT_NODE_MAX_CHARS = 0
/** Default maxChars for GraphGroup labels when style.maxChars is omitted (`0` = no truncate). */
const DEFAULT_GROUP_MAX_CHARS = 0

/** LabelAttachment — GraphNode.label / GraphGroup.label outside the body. */
export class LabelAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private position: AttachmentPosition = 'bottom'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label = isGroup ? ctx.group.label : ctx.node.label
    this.position = style?.labelPosition ?? (isGroup ? 'top' : 'bottom')
    this.color = style?.label?.color ?? DEFAULT_COLOR
    this.fontSize = style?.label?.fontSize ?? DEFAULT_FONT
    this.text = truncateText(
      label,
      resolveMaxChars(style?.label, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAttachment(ctx.body, this.position, size.width, size.height)
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp | undefined {
    if (this.text.length === 0) return undefined
    return {
      kind: 'label',
      layer: 'scene',
      bounds: this.cachedBounds,
      text: this.text,
      color: this.color,
      fontSize: this.fontSize,
    }
  }
}

/**
 * Secondary label attachment (default position: top).
 */
export class Label2Attachment extends Attachment {
  private text = ''
  private color = '#374151'
  private fontSize = 10
  private position: AttachmentPosition = 'top'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label2 = isGroup ? ctx.group.label2 : ctx.node.label2
    this.position = style?.label2Position ?? 'top'
    this.color = style?.label2?.color ?? '#374151'
    this.fontSize = style?.label2?.fontSize ?? 10
    this.text = truncateText(
      label2 ?? '',
      resolveMaxChars(style?.label2, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAttachment(ctx.body, this.position, size.width, size.height)
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp | undefined {
    if (this.text.length === 0) return undefined
    return {
      kind: 'label2',
      layer: 'scene',
      bounds: this.cachedBounds,
      text: this.text,
      color: this.color,
      fontSize: this.fontSize,
    }
  }
}

/**
 * Resolve maxChars from text style; omitted uses host default.
 * @param textStyle - optional label/label2 style.
 * @param hostDefault - default when `maxChars` omitted.
 */
export function resolveMaxChars(
  textStyle: GraphTextStyle | undefined,
  hostDefault: number,
): number {
  return textStyle?.maxChars ?? hostDefault
}

/**
 * Truncate with ellipsis. `maxChars <= 0` means never truncate.
 * @param text - raw label.
 * @param maxChars - max length; `0` or negative → full text.
 */
export function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text
  if (maxChars === 1) return '…'
  return `${text.slice(0, maxChars - 1)}…`
}

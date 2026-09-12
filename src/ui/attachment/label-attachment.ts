/**
 * Primary label attachment (default position: bottom).
 */

import type { AttachmentPosition } from '../../protocol/types.ts'
import { Attachment, isNodeAttachmentCtx, type AttachmentValidateCtx } from './attachment.ts'
import { estimateTextSize, placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const DEFAULT_COLOR = '#000000'
const DEFAULT_FONT = 12
const MAX_CHARS = 18

/** LabelAttachment — GraphNode.label outside the body. */
export class LabelAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private position: AttachmentPosition = 'bottom'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isNodeAttachmentCtx(ctx)) return
    const style = ctx.node.style
    this.position = style?.labelPosition ?? 'bottom'
    this.color = style?.label?.color ?? DEFAULT_COLOR
    this.fontSize = style?.label?.fontSize ?? DEFAULT_FONT
    this.text = truncate(ctx.node.label, MAX_CHARS)
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
    if (!isNodeAttachmentCtx(ctx)) return
    const style = ctx.node.style
    this.position = style?.label2Position ?? 'top'
    this.color = style?.label2?.color ?? '#374151'
    this.fontSize = style?.label2?.fontSize ?? 10
    this.text = truncate(ctx.node.label2 ?? '', MAX_CHARS)
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

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

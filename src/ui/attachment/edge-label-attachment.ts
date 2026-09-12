/**
 * Edge label attachments placed by arc-length ratio along the polyline.
 */

import {
  Attachment,
  isEdgeAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { resolveMaxChars, truncateText } from './label-attachment.ts'
import { estimateTextSize } from './position.ts'
import { placeAlongPath } from './path.ts'
import type { AttachmentPaintOp } from './types.ts'

const DEFAULT_COLOR = '#000000'
const DEFAULT_FONT = 11
/** Default maxChars for GraphEdge labels when style.maxChars is omitted. */
const DEFAULT_EDGE_MAX_CHARS = 18

/** EdgeLabelAttachment — GraphEdge.label along the path. */
export class EdgeLabelAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT

  validate(ctx: AttachmentValidateCtx): void {
    if (!isEdgeAttachmentCtx(ctx)) return
    const style = ctx.edge.style
    this.color = style?.label?.color ?? DEFAULT_COLOR
    this.fontSize = style?.label?.fontSize ?? DEFAULT_FONT
    this.text = truncateText(
      ctx.edge.label ?? '',
      resolveMaxChars(style?.label, DEFAULT_EDGE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAlongPath(
      ctx.points,
      style?.labelAt ?? 0.5,
      size.width,
      size.height,
    )
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

/** EdgeLabel2Attachment — GraphEdge.label2 along the path. */
export class EdgeLabel2Attachment extends Attachment {
  private text = ''
  private color = '#374151'
  private fontSize = 10

  validate(ctx: AttachmentValidateCtx): void {
    if (!isEdgeAttachmentCtx(ctx)) return
    const style = ctx.edge.style
    this.color = style?.label2?.color ?? '#374151'
    this.fontSize = style?.label2?.fontSize ?? 10
    this.text = truncateText(
      ctx.edge.label2 ?? '',
      resolveMaxChars(style?.label2, DEFAULT_EDGE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAlongPath(
      ctx.points,
      style?.label2At ?? 0.15,
      size.width,
      size.height,
    )
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

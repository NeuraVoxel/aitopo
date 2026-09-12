/**
 * Tooltip attachment — always on scene+union, or hover-only on overlay.
 */

import type { AttachmentPosition } from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { estimateTextSize, placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const PAD_X = 8
const PAD_Y = 4
const DEFAULT_COLOR = '#e8eaed'
const DEFAULT_BG = 'rgba(20, 24, 32, 0.92)'
const DEFAULT_FONT = 11
const MAX_CHARS = 48

/** TooltipAttachment for GraphNode.tooltip / GraphGroup.tooltip. */
export class TooltipAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private position: AttachmentPosition = 'right'
  private mode: 'hover' | 'always' = 'hover'

  /** Hover-mode tooltips do not inflate union / idle hit. */
  override contributesToUnion(): boolean {
    return this.mode === 'always'
  }

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const style = isGroupAttachmentCtx(ctx) ? ctx.group.style : ctx.node.style
    const tooltip = isGroupAttachmentCtx(ctx) ? ctx.group.tooltip : ctx.node.tooltip
    this.mode = style?.tooltipMode ?? 'hover'
    this.position = style?.tooltipPosition ?? 'right'
    this.color = style?.tooltip?.color ?? DEFAULT_COLOR
    this.fontSize = style?.tooltip?.fontSize ?? DEFAULT_FONT
    this.text = truncate(tooltip ?? '', MAX_CHARS)
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAttachment(
      ctx.body,
      this.position,
      size.width + PAD_X * 2,
      size.height + PAD_Y * 2,
    )
  }

  toPaintOp(hovered: boolean): AttachmentPaintOp | undefined {
    if (this.text.length === 0) return undefined
    if (this.mode === 'hover' && !hovered) return undefined
    return {
      kind: 'tooltip',
      layer: this.mode === 'always' ? 'scene' : 'overlay',
      bounds: this.cachedBounds,
      text: this.text,
      color: this.color,
      fontSize: this.fontSize,
      background: DEFAULT_BG,
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

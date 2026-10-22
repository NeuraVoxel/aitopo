/**
 * Tooltip attachment — always on scene+union, or hover-only on overlay.
 * Long text wraps to a fixed max content width so glyphs stay inside the background.
 */

import type { AttachmentPosition } from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { layoutWrappedText, placeTooltip } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const PAD_X = 8
const PAD_Y = 6
const DEFAULT_COLOR = '#e8eaed'
const DEFAULT_BG = 'rgba(20, 24, 32, 0.92)'
const DEFAULT_FONT = 11
/** Soft cap before wrapping; wrapping handles overflow past the background. */
const MAX_CHARS = 96
/** Content width (before padding) — ~14 CJK glyphs at 11px. */
const DEFAULT_MAX_CONTENT_WIDTH = 160

/** TooltipAttachment for GraphNode.tooltip / GraphGroup.tooltip. */
export class TooltipAttachment extends Attachment {
  private lines: readonly string[] = []
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private position: AttachmentPosition = 'topRight'
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
    this.position = style?.tooltipPosition ?? 'topRight'
    this.color = style?.tooltip?.color ?? DEFAULT_COLOR
    this.fontSize = style?.tooltip?.fontSize ?? DEFAULT_FONT
    const raw = truncate(tooltip ?? '', MAX_CHARS)
    const layout = layoutWrappedText(raw, this.fontSize, DEFAULT_MAX_CONTENT_WIDTH)
    this.lines = layout.lines
    this.cachedBounds = placeTooltip(
      ctx.body,
      this.position,
      layout.width + PAD_X * 2,
      layout.height + PAD_Y * 2,
    )
  }

  toPaintOp(hovered: boolean): AttachmentPaintOp | undefined {
    if (this.lines.length === 0 || (this.lines.length === 1 && this.lines[0] === '')) {
      return undefined
    }
    if (this.mode === 'hover' && !hovered) return undefined
    return {
      kind: 'tooltip',
      layer: this.mode === 'always' ? 'scene' : 'overlay',
      bounds: this.cachedBounds,
      text: this.lines.join('\n'),
      lines: this.lines,
      color: this.color,
      fontSize: this.fontSize,
      background: DEFAULT_BG,
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

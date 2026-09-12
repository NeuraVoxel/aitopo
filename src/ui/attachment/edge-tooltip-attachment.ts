/**
 * Tooltip along an edge — always on scene+union, or hover-only on overlay.
 */

import {
  Attachment,
  isEdgeAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { estimateTextSize } from './position.ts'
import { placeAlongPath } from './path.ts'
import type { AttachmentPaintOp } from './types.ts'

const PAD_X = 8
const PAD_Y = 4
const DEFAULT_COLOR = '#e8eaed'
const DEFAULT_BG = 'rgba(20, 24, 32, 0.92)'
const DEFAULT_FONT = 11
const MAX_CHARS = 48

/** EdgeTooltipAttachment for GraphEdge.tooltip. */
export class EdgeTooltipAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private mode: 'hover' | 'always' = 'hover'

  /** Hover-mode tooltips do not inflate union. */
  override contributesToUnion(): boolean {
    return this.mode === 'always'
  }

  validate(ctx: AttachmentValidateCtx): void {
    if (!isEdgeAttachmentCtx(ctx)) return
    const style = ctx.edge.style
    this.mode = style?.tooltipMode ?? 'hover'
    this.color = style?.tooltip?.color ?? DEFAULT_COLOR
    this.fontSize = style?.tooltip?.fontSize ?? DEFAULT_FONT
    this.text = truncate(ctx.edge.tooltip ?? '', MAX_CHARS)
    const size = estimateTextSize(this.text, this.fontSize)
    this.cachedBounds = placeAlongPath(
      ctx.points,
      style?.tooltipAt ?? 0.5,
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

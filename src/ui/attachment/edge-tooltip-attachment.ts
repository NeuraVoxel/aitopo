/**
 * Tooltip along an edge — always on scene+union, or hover-only on overlay.
 * Long text wraps like node tooltips so glyphs stay inside the background.
 */

import {
  Attachment,
  isEdgeAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { layoutWrappedText } from './position.ts'
import { placeAlongPath } from './path.ts'
import type { AttachmentPaintOp } from './types.ts'

const PAD_X = 8
const PAD_Y = 6
const DEFAULT_COLOR = '#e8eaed'
const DEFAULT_BG = 'rgba(20, 24, 32, 0.92)'
const DEFAULT_FONT = 11
const MAX_CHARS = 96
const DEFAULT_MAX_CONTENT_WIDTH = 160

/** EdgeTooltipAttachment for GraphEdge.tooltip. */
export class EdgeTooltipAttachment extends Attachment {
  private lines: readonly string[] = []
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
    const raw = truncate(ctx.edge.tooltip ?? '', MAX_CHARS)
    const layout = layoutWrappedText(raw, this.fontSize, DEFAULT_MAX_CONTENT_WIDTH)
    this.lines = layout.lines
    this.cachedBounds = placeAlongPath(
      ctx.points,
      style?.tooltipAt ?? 0.5,
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

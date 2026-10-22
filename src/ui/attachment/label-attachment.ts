/**
 * Primary / secondary labels for nodes and groups.
 *
 * Default principle: title centered in the body; subtitle centered under the title
 * (fixed gap). Applies to Node, Group, and SubNetwork document elements alike.
 */

import type { AttachmentPosition, GraphTextStyle } from '../../protocol/types.ts'
import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
  type BoxAttachmentValidateCtx,
} from './attachment.ts'
import { estimateTextSize, placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'
import type { Rect } from '../../geom.ts'

const DEFAULT_COLOR = '#000000'
const DEFAULT_FONT = 12
/**
 * Default maxChars for GraphNode labels when style.maxChars is omitted.
 * `0` = no truncate; opt in per element via `style.label.maxChars`.
 */
const DEFAULT_NODE_MAX_CHARS = 0
/** Default maxChars for GraphGroup labels when style.maxChars is omitted (`0` = no truncate). */
const DEFAULT_GROUP_MAX_CHARS = 0
/** World px between title bottom and subtitle top. */
const TITLE_SUBTITLE_GAP = 2
/** Default title anchor for Node / Group / SubNetwork members. */
const DEFAULT_LABEL_POSITION: AttachmentPosition = 'center'
/** Default subtitle anchor — resolved as fixed-gap under title when paired with center. */
const DEFAULT_LABEL2_POSITION: AttachmentPosition = 'insideBottom'

/** LabelAttachment — GraphNode.label / GraphGroup.label. */
export class LabelAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private position: AttachmentPosition = DEFAULT_LABEL_POSITION

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label = isGroup ? ctx.group.label : ctx.node.label
    const label2 = isGroup ? ctx.group.label2 : ctx.node.label2
    this.position = style?.labelPosition ?? DEFAULT_LABEL_POSITION
    this.color = style?.label?.color ?? DEFAULT_COLOR
    this.fontSize = style?.label?.fontSize ?? DEFAULT_FONT
    this.text = truncateText(
      label,
      resolveMaxChars(style?.label, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    let box = placeAttachment(ctx.body, this.position, size.width, size.height)
    if (usesTitleSubtitleStack(this.position, label2, style?.label2Position)) {
      box = nudgeTitleForSubtitle(box, ctx.body.height)
    }
    this.cachedBounds = box
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

/** Label2Attachment — GraphNode.label2 / GraphGroup.label2. */
export class Label2Attachment extends Attachment {
  private text = ''
  private color = '#374151'
  private fontSize = 10
  private position: AttachmentPosition = DEFAULT_LABEL2_POSITION

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label = isGroup ? ctx.group.label : ctx.node.label
    const label2 = isGroup ? ctx.group.label2 : ctx.node.label2
    this.position = style?.label2Position ?? DEFAULT_LABEL2_POSITION
    this.color = style?.label2?.color ?? '#374151'
    this.fontSize = style?.label2?.fontSize ?? 10
    this.text = truncateText(
      label2 ?? '',
      resolveMaxChars(style?.label2, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize)
    const titlePosition = style?.labelPosition ?? DEFAULT_LABEL_POSITION

    if (
      this.position === 'insideBottom'
      && titlePosition === 'center'
      && typeof label === 'string'
      && label.length > 0
    ) {
      this.cachedBounds = placeSubtitleUnderTitle(ctx, label, style, size, isGroup)
      return
    }

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

function usesTitleSubtitleStack(
  labelPosition: AttachmentPosition,
  label2: string | undefined,
  label2Position: AttachmentPosition | undefined,
): boolean {
  const subPos = label2Position ?? DEFAULT_LABEL2_POSITION
  return (
    labelPosition === 'center'
    && typeof label2 === 'string'
    && label2.length > 0
    && subPos === 'insideBottom'
  )
}

function nudgeTitleForSubtitle(box: Rect, bodyHeight: number): Rect {
  return {
    ...box,
    y: box.y - Math.min(4, bodyHeight * 0.04),
  }
}

function placeSubtitleUnderTitle(
  ctx: BoxAttachmentValidateCtx,
  label: string,
  style: { readonly label?: GraphTextStyle | undefined } | undefined,
  size: { width: number; height: number },
  isGroup: boolean,
): Rect {
  const titleFont = style?.label?.fontSize ?? DEFAULT_FONT
  const titleText = truncateText(
    label,
    resolveMaxChars(style?.label, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
  )
  const titleSize = estimateTextSize(titleText, titleFont)
  let titleBox = placeAttachment(ctx.body, 'center', titleSize.width, titleSize.height)
  titleBox = nudgeTitleForSubtitle(titleBox, ctx.body.height)
  const cx = ctx.body.x + ctx.body.width / 2
  let y = titleBox.y + titleSize.height + TITLE_SUBTITLE_GAP
  const maxY = ctx.body.y + ctx.body.height - 4 - size.height
  if (y > maxY) y = maxY
  return {
    x: cx - size.width / 2,
    y,
    width: size.width,
    height: size.height,
  }
}

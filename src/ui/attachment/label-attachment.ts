/**
 * Primary / secondary labels for nodes and groups.
 *
 * Node label defaults to bottom. Group title: expanded → `labelPosition` (omit `top`);
 * collapsed → `collapsedLabelPosition` (omit `bottom`). Label2 defaults to top.
 * When authors set center/insideTop + insideBottom, subtitle stacks under the title.
 */

import type { AttachmentPosition, GraphGroup, GraphTextStyle } from '../../protocol/types.ts'
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
import { isGroupExpanded } from '../group-state.ts'

const DEFAULT_COLOR = '#000000'
const DEFAULT_FONT = 12
/**
 * Default maxChars for GraphNode labels when style.maxChars is omitted.
 * `0` = no truncate; opt in per element via `style.label.maxChars`.
 */
const DEFAULT_NODE_MAX_CHARS = 0
/** Default maxChars for GraphGroup labels when style.maxChars is omitted (`0` = no truncate). */
const DEFAULT_GROUP_MAX_CHARS = 0
/** World px between title bottom and subtitle top (center/insideTop + insideBottom). */
const TITLE_SUBTITLE_GAP = 2

/** LabelAttachment — GraphNode.label / GraphGroup.label. */
export class LabelAttachment extends Attachment {
  private text = ''
  private color = DEFAULT_COLOR
  private fontSize = DEFAULT_FONT
  private fontWeight: 'normal' | 'bold' = 'normal'
  private position: AttachmentPosition = 'bottom'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label = isGroup ? ctx.group.label : ctx.node.label
    const label2 = isGroup ? ctx.group.label2 : ctx.node.label2
    this.position = isGroup
      ? resolveGroupLabelPosition(ctx.group)
      : (style?.labelPosition ?? 'bottom')
    this.color = style?.label?.color ?? DEFAULT_COLOR
    this.fontSize = style?.label?.fontSize ?? DEFAULT_FONT
    this.fontWeight = style?.label?.fontWeight ?? 'normal'
    this.text = truncateText(
      label,
      resolveMaxChars(style?.label, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize, this.fontWeight)
    let box = placeAttachment(ctx.body, this.position, size.width, size.height)
    if (
      !isGroup
      && this.position === 'center'
      && usesTitleSubtitleStack(this.position, label2, style?.label2Position)
    ) {
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
      ...(this.fontWeight === 'bold' ? { fontWeight: 'bold' as const } : {}),
    }
  }
}

/** Label2Attachment — GraphNode.label2 / GraphGroup.label2. */
export class Label2Attachment extends Attachment {
  private text = ''
  private color = '#374151'
  private fontSize = 10
  private position: AttachmentPosition = 'top'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    const isGroup = isGroupAttachmentCtx(ctx)
    const style = isGroup ? ctx.group.style : ctx.node.style
    const label = isGroup ? ctx.group.label : ctx.node.label
    const label2 = isGroup ? ctx.group.label2 : ctx.node.label2
    this.position = style?.label2Position ?? 'top'
    this.color = style?.label2?.color ?? '#374151'
    this.fontSize = style?.label2?.fontSize ?? 10
    this.text = truncateText(
      label2 ?? '',
      resolveMaxChars(style?.label2, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
    )
    const size = estimateTextSize(this.text, this.fontSize, style?.label2?.fontWeight ?? 'normal')
    const titlePosition = isGroup
      ? resolveGroupLabelPosition(ctx.group)
      : (style?.labelPosition ?? 'bottom')

    if (
      this.position === 'insideBottom'
      && isStackedTitlePosition(titlePosition)
      && typeof label === 'string'
      && label.length > 0
    ) {
      this.cachedBounds = placeSubtitleUnderTitle(ctx, label, titlePosition, style, size, isGroup)
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

/**
 * Group title side: expanded uses `labelPosition` (omit → top);
 * collapsed uses `collapsedLabelPosition` (omit → bottom).
 * @param group - live group.
 */
export function resolveGroupLabelPosition(group: GraphGroup): AttachmentPosition {
  const style = group.style
  if (isGroupExpanded(group)) {
    return style?.labelPosition ?? 'top'
  }
  return style?.collapsedLabelPosition ?? 'bottom'
}

function isStackedTitlePosition(position: AttachmentPosition): boolean {
  return position === 'center' || position === 'insideTop'
    || position === 'insideTopLeft' || position === 'insideTopRight'
}

function usesTitleSubtitleStack(
  labelPosition: AttachmentPosition,
  label2: string | undefined,
  label2Position: AttachmentPosition | undefined,
): boolean {
  return (
    isStackedTitlePosition(labelPosition)
    && typeof label2 === 'string'
    && label2.length > 0
    && label2Position === 'insideBottom'
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
  titlePosition: AttachmentPosition,
  style: { readonly label?: GraphTextStyle | undefined } | undefined,
  size: { width: number; height: number },
  isGroup: boolean,
): Rect {
  const titleFont = style?.label?.fontSize ?? DEFAULT_FONT
  const titleWeight = style?.label?.fontWeight ?? 'normal'
  const titleText = truncateText(
    label,
    resolveMaxChars(style?.label, isGroup ? DEFAULT_GROUP_MAX_CHARS : DEFAULT_NODE_MAX_CHARS),
  )
  const titleSize = estimateTextSize(titleText, titleFont, titleWeight)
  let titleBox = placeAttachment(ctx.body, titlePosition, titleSize.width, titleSize.height)
  if (titlePosition === 'center') {
    titleBox = nudgeTitleForSubtitle(titleBox, ctx.body.height)
  }
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

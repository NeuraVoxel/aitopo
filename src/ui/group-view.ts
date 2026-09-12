/**
 * Cached group band geometry, attachments, and paint DTOs.
 */

import { unionRect, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphChromeStyle, GraphShadowStyle } from '../protocol/types.ts'
import type { GroupPaintView } from '../render/canvas2d.ts'
import {
  AlarmAttachment,
  Attachment,
  Label2Attachment,
  LabelAttachment,
  TooltipAttachment,
  type AttachmentPaintOp,
} from './attachment/index.ts'
import { computeGroupBandBounds, isGroupExpanded } from './group-state.ts'

/** Per-group View: invalidate → validate attachments → paint DTO. */
export class GroupView {
  readonly id: string
  private dirty = true
  private band: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private union: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private active = false
  private expanded = false
  private alpha = 1
  private stroke = '#5a6478'
  private fill = 'rgba(90, 100, 120, 0.08)'
  private strokeWidth = 1
  private strokeDash: readonly number[] | undefined
  private shadow: GraphShadowStyle | undefined
  private selectStyle: GraphChromeStyle | undefined
  private hoverStyle: GraphChromeStyle | undefined
  private attachments: Attachment[] = []
  private sceneOps: AttachmentPaintOp[] = []
  private overlayOps: AttachmentPaintOp[] = []

  constructor(id: string) {
    this.id = id
  }

  /** Union bounds (dirty + hit); excludes hover-only tooltip. */
  get bounds(): Rect {
    return this.union
  }

  /** Band body for chrome / auto-fit / agent anchors. */
  get bandBounds(): Rect {
    return this.band
  }

  /** Alias for {@link bounds}. */
  get unionBounds(): Rect {
    return this.union
  }

  get isActive(): boolean {
    return this.active
  }

  get isExpanded(): boolean {
    return this.expanded
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute band, attachments, and union when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const group = scene.groups.get(this.id)
    if (group === undefined) {
      this.resetInactive()
      return
    }
    this.active = true
    this.expanded = isGroupExpanded(group)
    this.band = computeGroupBandBounds(scene, group)
    const style = group.style
    this.alpha = clampAlpha(style?.alpha)
    this.stroke = style?.stroke ?? '#5a6478'
    this.fill = style?.fill ?? 'rgba(90, 100, 120, 0.08)'
    this.strokeWidth = style?.strokeWidth ?? 1
    this.strokeDash = style?.strokeDash
    this.shadow = style?.shadow
    this.selectStyle = style?.select
    this.hoverStyle = style?.hover
    this.attachments = syncAttachments(group, this.attachments)
    const ctx = { group, body: this.band }
    let union: Rect | undefined = this.band
    for (const attachment of this.attachments) {
      attachment.validate(ctx)
      if (attachment.contributesToUnion()) {
        union = unionRect(union, attachment.bounds)
      }
    }
    this.union = union ?? this.band
    this.dirty = false
  }

  /**
   * Build a paint DTO; chrome flags and hover tooltip depend on selection/hover.
   * @param selected - selection chrome.
   * @param hovered - hover chrome / tooltip.
   */
  toPaintView(selected: boolean, hovered: boolean): GroupPaintView {
    this.sceneOps = []
    this.overlayOps = []
    for (const attachment of this.attachments) {
      const op = attachment.toPaintOp(hovered)
      if (op === undefined) continue
      if (op.layer === 'overlay') this.overlayOps.push(op)
      else this.sceneOps.push(op)
    }
    return {
      bounds: this.union,
      bandBounds: this.band,
      unionBounds: this.union,
      selected,
      hovered,
      expanded: this.expanded,
      alpha: this.alpha,
      stroke: this.stroke,
      fill: this.fill,
      strokeWidth: this.strokeWidth,
      ...(this.strokeDash !== undefined ? { strokeDash: this.strokeDash } : {}),
      ...(this.shadow !== undefined ? { shadow: this.shadow } : {}),
      ...(this.selectStyle !== undefined ? { selectStyle: this.selectStyle } : {}),
      ...(this.hoverStyle !== undefined ? { hoverStyle: this.hoverStyle } : {}),
      attachments: this.sceneOps,
      overlayAttachments: this.overlayOps,
    }
  }

  private resetInactive(): void {
    this.active = false
    this.expanded = false
    this.band = { x: 0, y: 0, width: 0, height: 0 }
    this.union = this.band
    this.alpha = 1
    this.strokeDash = undefined
    this.shadow = undefined
    this.selectStyle = undefined
    this.hoverStyle = undefined
    this.attachments = []
    this.sceneOps = []
    this.overlayOps = []
    this.dirty = false
  }
}

function clampAlpha(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function syncAttachments(
  group: import('../protocol/types.ts').GraphGroup,
  previous: Attachment[],
): Attachment[] {
  const next: Attachment[] = []
  if (group.label.length > 0) {
    next.push(takeOrCreate(previous, LabelAttachment, () => new LabelAttachment()))
  }
  if (group.label2 !== undefined && group.label2.length > 0) {
    next.push(takeOrCreate(previous, Label2Attachment, () => new Label2Attachment()))
  }
  if (group.alarms !== undefined && group.alarms.length > 0) {
    next.push(takeOrCreate(previous, AlarmAttachment, () => new AlarmAttachment()))
  }
  if (group.tooltip !== undefined && group.tooltip.length > 0) {
    next.push(takeOrCreate(previous, TooltipAttachment, () => new TooltipAttachment()))
  }
  return next
}

function takeOrCreate<T extends Attachment>(
  previous: Attachment[],
  ctor: abstract new (...args: never[]) => T,
  create: () => T,
): T {
  const found = previous.find((a): a is T => a instanceof ctor)
  return found ?? create()
}

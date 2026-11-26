/**
 * Cached group band / collapsed-node geometry, attachments, and paint DTOs.
 */

import {
  anglePivot,
  normalizeAngleDegrees,
  rotatedAabbOfRectAbout,
  unionRect,
  type Point,
  type Rect,
} from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type {
  GraphAngleAnchor,
  GraphChromeStyle,
  GraphGroup,
  GraphShadowStyle,
} from '../protocol/types.ts'
import type { GroupPaintView } from '../render/canvas2d.ts'
import {
  AlarmAttachment,
  Attachment,
  IconsAttachment,
  Label2Attachment,
  LabelAttachment,
  TooltipAttachment,
  type AttachmentPaintOp,
} from './attachment/index.ts'
import {
  computeGroupBandBounds,
  isGroupExpanded,
  isGroupVisibleInScene,
  type MemberBoundsResolver,
  type ShapeNodeBoundsResolver,
} from './group-state.ts'

// Collapsed groups paint as nodes: match the default node body (statusFill/statusStroke).
const COLLAPSED_FILL = '#1a1d24'
const COLLAPSED_STROKE = '#334155'
const EXPANDED_FILL = 'rgba(90, 100, 120, 0.08)'
const EXPANDED_STROKE = '#5a6478'

/** Per-group View: invalidate → validate attachments → paint DTO. */
export class GroupView {
  readonly id: string
  private dirty = true
  private band: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Rotated AABB of {@link originalUnion} (dirty / cull); equals it when angle ≡ 0. */
  private union: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Unrotated band ∪ attachments (hit after inverse rotation). */
  private originalUnion: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private angleDeg = 0
  private angleAnchorCache: GraphAngleAnchor | undefined
  private active = false
  private visible = true
  private expanded = false
  private alpha = 1
  private stroke = EXPANDED_STROKE
  private fill = EXPANDED_FILL
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

  /** Rotated union AABB (dirty + hit cull); excludes hover-only tooltip. */
  get bounds(): Rect {
    return this.union
  }

  /** Unrotated band ∪ attachments. */
  get originalUnionBounds(): Rect {
    return this.originalUnion
  }

  /** Normalized rotation degrees (`0` when omitted). */
  get angle(): number {
    return this.angleDeg
  }

  /** Authored relative pivot; undefined ≡ center. */
  get angleAnchor(): GraphAngleAnchor | undefined {
    return this.angleAnchorCache
  }

  /** World rotation pivot inside the original band. */
  get pivot(): Point {
    return anglePivot(this.band, this.angleAnchorCache)
  }

  /** Original (unrotated) band / collapsed body for chrome / auto-fit / agent anchors. */
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

  /** Whether ancestors are expanded so this group should paint / hit. */
  get isVisible(): boolean {
    return this.active && this.visible
  }

  get isExpanded(): boolean {
    return this.expanded
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute body, attachments, and union when dirty.
   * @param scene - active graph scene.
   * @param memberBoundsOf - optional paint-extent resolver for boxed members.
   * @param shapeNodeBoundsOf - optional paint-extent resolver for shape members.
   */
  validate(
    scene: GraphScene,
    memberBoundsOf?: MemberBoundsResolver,
    shapeNodeBoundsOf?: ShapeNodeBoundsResolver,
  ): void {
    if (!this.dirty) return
    const group = scene.groups.get(this.id)
    if (group === undefined) {
      this.resetInactive()
      return
    }
    this.active = true
    this.visible = isGroupVisibleInScene(scene, this.id)
    this.expanded = isGroupExpanded(group)
    this.band = computeGroupBandBounds(
      scene,
      group,
      memberBoundsOf,
      shapeNodeBoundsOf,
    )
    this.angleDeg = normalizeAngleDegrees(group.angle ?? 0)
    this.angleAnchorCache = group.angleAnchor
    const style = group.style
    const dataFill = typeof group.data?.fill === 'string' ? group.data.fill : undefined
    const dataStroke = typeof group.data?.stroke === 'string' ? group.data.stroke : undefined
    this.alpha = clampAlpha(style?.alpha)
    if (this.expanded) {
      this.stroke = style?.stroke ?? dataStroke ?? EXPANDED_STROKE
      this.fill = style?.fill ?? dataFill ?? EXPANDED_FILL
      this.strokeWidth = style?.strokeWidth ?? 1
      this.strokeDash = style?.strokeDash
    } else {
      // Collapsed: opaque node body (twaver Group → NodeUI), not translucent band.
      // Prefer style, then data (skill diagrams often author fill on data like nodes).
      this.stroke = style?.stroke ?? dataStroke ?? COLLAPSED_STROKE
      this.fill = style?.fill ?? dataFill ?? COLLAPSED_FILL
      this.strokeWidth = style?.strokeWidth ?? 1.25
      this.strokeDash = undefined
    }
    this.shadow = style?.shadow == null ? undefined : style.shadow
    this.selectStyle = style?.select
    this.hoverStyle = style?.hover
    this.attachments = syncAttachments(group, this.expanded, this.attachments)
    const ctx = { group, body: this.band }
    let union: Rect | undefined = this.band
    for (const attachment of this.attachments) {
      attachment.validate(ctx)
      if (attachment.contributesToUnion()) {
        union = unionRect(union, attachment.bounds)
      }
    }
    this.originalUnion = union ?? this.band
    this.union = rotatedAabbOfRectAbout(
      this.originalUnion,
      anglePivot(this.band, this.angleAnchorCache),
      this.angleDeg,
    )
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
      ...(this.angleDeg !== 0 ? { angle: this.angleDeg } : {}),
      ...(this.angleAnchorCache !== undefined ? { angleAnchor: this.angleAnchorCache } : {}),
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
    this.visible = false
    this.expanded = false
    this.band = { x: 0, y: 0, width: 0, height: 0 }
    this.union = this.band
    this.originalUnion = this.band
    this.angleDeg = 0
    this.angleAnchorCache = undefined
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
  group: GraphGroup,
  expanded: boolean,
  previous: Attachment[],
): Attachment[] {
  const next: Attachment[] = []
  if (!expanded && group.style?.showIcon !== false) {
    next.push(takeOrCreate(previous, IconsAttachment, () => new IconsAttachment()))
  }
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

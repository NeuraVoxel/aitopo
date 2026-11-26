/**
 * Cached node geometry, attachments, and paint DTOs.
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
import type { GraphAngleAnchor, GraphChromeStyle, GraphShadowStyle } from '../protocol/types.ts'
import type { NodePaintView } from '../render/canvas2d.ts'
import {
  AlarmAttachment,
  Attachment,
  IconsAttachment,
  Label2Attachment,
  LabelAttachment,
  TooltipAttachment,
  type AttachmentPaintOp,
} from './attachment/index.ts'
import { nodeBounds } from './bounds.ts'
import { isNodeVisibleInScene } from './group-state.ts'
import { getVectorImage, vectorImagePaintCtx } from './vector-image-registry.ts'

const DEFAULT_SHADOW: GraphShadowStyle = {
  color: 'rgba(0, 0, 0, 0.35)',
  blur: 6,
  offsetX: 0,
  offsetY: 2,
}

/** Per-node View: invalidate → validate attachments → paint DTO. */
export class NodeView {
  readonly id: string
  private dirty = true
  private body: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Rotated AABB of {@link originalUnion} (dirty / cull); equals it when angle ≡ 0. */
  private union: Rect = { x: 0, y: 0, width: 0, height: 0 }
  /** Unrotated body ∪ attachments (hit after inverse rotation). */
  private originalUnion: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private angleDeg = 0
  private angleAnchorCache: GraphAngleAnchor | undefined
  private circular = false
  private active = false
  private shadow: GraphShadowStyle | undefined
  private alpha = 1
  private strokeDash: readonly number[] | undefined
  private selectStyle: GraphChromeStyle | undefined
  private hoverStyle: GraphChromeStyle | undefined
  private attachments: Attachment[] = []
  private sceneOps: AttachmentPaintOp[] = []
  private overlayOps: AttachmentPaintOp[] = []
  /** False when the owning group is collapsed (still active in scene). */
  private visible = true

  constructor(id: string) {
    this.id = id
  }

  /** Rotated union AABB (dirty + hit cull); excludes hover-only tooltip. */
  get bounds(): Rect {
    return this.union
  }

  /** Unrotated body ∪ attachments (hit-test after inverse-rotating the pointer). */
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

  /** World rotation pivot inside the original body. */
  get pivot(): Point {
    return anglePivot(this.body, this.angleAnchorCache)
  }

  /** Original (unrotated) body box for anchors / move / resize / select chrome. */
  get bodyBounds(): Rect {
    return this.body
  }

  /** Alias for {@link bounds}. */
  get unionBounds(): Rect {
    return this.union
  }

  /** Whether the node exists in the scene after validate. */
  get isActive(): boolean {
    return this.active
  }

  /** Whether the node should be painted and hit-tested. */
  get isVisible(): boolean {
    return this.active && this.visible
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute body, attachments, and union when dirty.
   * @param scene - active graph scene.
   * @param opts - host defaults (icon visibility).
   */
  validate(
    scene: GraphScene,
    opts: { readonly showNodeIconsDefault?: boolean } = {},
  ): void {
    if (!this.dirty) return
    const node = scene.nodes.get(this.id)
    if (node === undefined) {
      this.active = false
      this.visible = false
      this.body = { x: 0, y: 0, width: 0, height: 0 }
      this.union = this.body
      this.originalUnion = this.body
      this.angleDeg = 0
      this.angleAnchorCache = undefined
      this.circular = false
      this.shadow = undefined
      this.alpha = 1
      this.strokeDash = undefined
      this.selectStyle = undefined
      this.hoverStyle = undefined
      this.attachments = []
      this.sceneOps = []
      this.overlayOps = []
      this.dirty = false
      return
    }
    this.active = true
    this.visible = isNodeVisibleInScene(scene, this.id)
    this.body = nodeBounds(node)
    this.angleDeg = normalizeAngleDegrees(node.angle ?? 0)
    this.angleAnchorCache = node.angleAnchor
    this.circular = node.type === 'tool' || node.data?.shape === 'circle'
    // `null` opts out of the default soft shadow (dense occupancy cells, etc.).
    this.shadow = node.style?.shadow === null
      ? undefined
      : (node.style?.shadow ?? DEFAULT_SHADOW)
    this.alpha = clampAlpha(node.style?.alpha)
    this.strokeDash = node.style?.strokeDash
    this.selectStyle = node.style?.select
    this.hoverStyle = node.style?.hover
    const showIcon = node.style?.showIcon ?? opts.showNodeIconsDefault !== false
    this.attachments = syncAttachments(node, this.attachments, showIcon)
    const ctx = { node, body: this.body }
    let union: Rect | undefined = this.body
    for (const attachment of this.attachments) {
      attachment.validate(ctx)
      if (attachment.contributesToUnion()) {
        union = unionRect(union, attachment.bounds)
      }
    }
    const vectorImage = getVectorImage(node.vectorImage)
    if (vectorImage?.bounds !== undefined) {
      union = unionRect(union, vectorImage.bounds(this.body, vectorImagePaintCtx(node)))
    }
    this.originalUnion = union ?? this.body
    this.union = rotatedAabbOfRectAbout(
      this.originalUnion,
      anglePivot(this.body, this.angleAnchorCache),
      this.angleDeg,
    )
    this.dirty = false
  }

  /**
   * Build a paint DTO; chrome flags and hover tooltip depend on selection/hover.
   * @param selected - selection chrome.
   * @param hovered - hover chrome / tooltip.
   */
  toPaintView(selected: boolean, hovered: boolean): NodePaintView {
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
      bodyBounds: this.body,
      unionBounds: this.union,
      selected,
      hovered,
      ...(this.angleDeg !== 0 ? { angle: this.angleDeg } : {}),
      ...(this.angleAnchorCache !== undefined ? { angleAnchor: this.angleAnchorCache } : {}),
      circular: this.circular,
      alpha: this.alpha,
      ...(this.shadow !== undefined ? { shadow: this.shadow } : {}),
      ...(this.strokeDash !== undefined ? { strokeDash: this.strokeDash } : {}),
      ...(this.selectStyle !== undefined ? { selectStyle: this.selectStyle } : {}),
      ...(this.hoverStyle !== undefined ? { hoverStyle: this.hoverStyle } : {}),
      attachments: this.sceneOps,
      overlayAttachments: this.overlayOps,
    }
  }
}

/** Clamp style.alpha into `[0, 1]`; omitted → opaque. */
function clampAlpha(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function syncAttachments(
  node: import('../protocol/types.ts').GraphNode,
  previous: Attachment[],
  showIcon: boolean,
): Attachment[] {
  const next: Attachment[] = []
  if (showIcon) {
    next.push(takeOrCreate(previous, IconsAttachment, () => new IconsAttachment()))
  }
  if (node.label.length > 0) {
    next.push(takeOrCreate(previous, LabelAttachment, () => new LabelAttachment()))
  }
  if (node.label2 !== undefined && node.label2.length > 0) {
    next.push(takeOrCreate(previous, Label2Attachment, () => new Label2Attachment()))
  }
  if (node.alarms !== undefined && node.alarms.length > 0) {
    next.push(takeOrCreate(previous, AlarmAttachment, () => new AlarmAttachment()))
  }
  if (node.tooltip !== undefined && node.tooltip.length > 0) {
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

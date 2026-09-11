/**
 * Cached node geometry, attachments, and paint DTOs.
 */

import { unionRect, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GraphChromeStyle, GraphShadowStyle } from '../protocol/types.ts'
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
  private union: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private circular = false
  private active = false
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

  /** Body box for anchors / move / resize / select chrome. */
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

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute body, attachments, and union when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const node = scene.nodes.get(this.id)
    if (node === undefined) {
      this.active = false
      this.body = { x: 0, y: 0, width: 0, height: 0 }
      this.union = this.body
      this.circular = false
      this.shadow = undefined
      this.selectStyle = undefined
      this.hoverStyle = undefined
      this.attachments = []
      this.sceneOps = []
      this.overlayOps = []
      this.dirty = false
      return
    }
    this.active = true
    this.body = nodeBounds(node)
    this.circular = node.type === 'tool' || node.data?.shape === 'circle'
    this.shadow = node.style?.shadow ?? DEFAULT_SHADOW
    this.selectStyle = node.style?.select
    this.hoverStyle = node.style?.hover
    this.attachments = syncAttachments(node, this.attachments)
    const ctx = { node, body: this.body }
    let union: Rect | undefined = this.body
    for (const attachment of this.attachments) {
      attachment.validate(ctx)
      if (attachment.contributesToUnion()) {
        union = unionRect(union, attachment.bounds)
      }
    }
    this.union = union ?? this.body
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
      circular: this.circular,
      ...(this.shadow !== undefined ? { shadow: this.shadow } : {}),
      ...(this.selectStyle !== undefined ? { selectStyle: this.selectStyle } : {}),
      ...(this.hoverStyle !== undefined ? { hoverStyle: this.hoverStyle } : {}),
      attachments: this.sceneOps,
      overlayAttachments: this.overlayOps,
    }
  }
}

function syncAttachments(
  node: import('../protocol/types.ts').GraphNode,
  previous: Attachment[],
): Attachment[] {
  const next: Attachment[] = []
  // Icons show only when the document sets `icon` (no default glyph).
  if (node.icon !== undefined && node.icon.length > 0) {
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

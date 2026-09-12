/**
 * Attachment paint DTOs shared by NodeView and Renderer.
 */

import type { Rect } from '../../geom.ts'
import type { AlarmLevel } from '../../protocol/types.ts'

/** Which canvas pass draws this attachment. */
export type AttachmentPaintLayer = 'scene' | 'overlay'

/** Serializable paint instruction for one attachment. */
export type AttachmentPaintOp =
  | {
    readonly kind: 'label' | 'label2'
    readonly layer: AttachmentPaintLayer
    readonly bounds: Rect
    readonly text: string
    readonly color: string
    readonly fontSize: number
  }
  | {
    readonly kind: 'icons'
    readonly layer: AttachmentPaintLayer
    readonly bounds: Rect
    readonly iconKey: string
    /** Stroke/fill for the glyph; renderer may override for body contrast. */
    readonly color?: string
  }
  | {
    readonly kind: 'alarm'
    readonly layer: AttachmentPaintLayer
    readonly bounds: Rect
    readonly level: AlarmLevel
    readonly radius: number
    /** Optional badge text (e.g. Turn count) painted centered in the circle. */
    readonly text?: string
  }
  | {
    readonly kind: 'tooltip'
    readonly layer: AttachmentPaintLayer
    readonly bounds: Rect
    readonly text: string
    readonly color: string
    readonly fontSize: number
    readonly background: string
  }

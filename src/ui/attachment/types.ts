/**
 * Attachment paint DTOs shared by NodeView and Renderer.
 */

import type { Rect } from '../../geom.ts'
import type { AlarmLevel, AlarmVariant } from '../../protocol/types.ts'

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
    /** Canvas font weight; omitted → `normal`. */
    readonly fontWeight?: 'normal' | 'bold'
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
    /** Chrome shape. Omitted → `dot`. */
    readonly variant?: AlarmVariant
    /** Dot radius in world px (required for `dot`). */
    readonly radius?: number
    /** Outline / ink for `tag`; omitted → level palette. */
    readonly color?: string
    readonly fontSize?: number
    /** Optional badge text painted centered in the chrome. */
    readonly text?: string
  }
  | {
    readonly kind: 'tooltip'
    readonly layer: AttachmentPaintLayer
    readonly bounds: Rect
    /** Full text (joined with `\n` when wrapped). */
    readonly text: string
    /** Wrapped lines for paint; omitted → single-line `text`. */
    readonly lines?: readonly string[]
    readonly color: string
    readonly fontSize: number
    readonly background: string
  }

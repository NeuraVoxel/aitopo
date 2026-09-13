/**
 * Centered vector icon attachment (IconRegistry key).
 */

import {
  Attachment,
  isBoxAttachmentCtx,
  isGroupAttachmentCtx,
  type AttachmentValidateCtx,
} from './attachment.ts'
import { getIcon } from './icon-registry.ts'
import { placeAttachment } from './position.ts'
import type { AttachmentPaintOp } from './types.ts'

const SIZE_FACTOR = 0.55

/** IconsAttachment — main icon at center (node or collapsed group). */
export class IconsAttachment extends Attachment {
  private iconKey = 'node'

  validate(ctx: AttachmentValidateCtx): void {
    if (!isBoxAttachmentCtx(ctx)) return
    if (isGroupAttachmentCtx(ctx)) {
      const resolved = getIcon(ctx.group.icon ?? 'group', 'group')
      this.iconKey = resolved.key
    } else if (ctx.node.icon !== undefined) {
      // Explicit key wins; unknown keys fall back to `node` (registry default).
      this.iconKey = getIcon(ctx.node.icon).key
    } else {
      // Enterable nodes advertise their nested network.
      this.iconKey = getIcon(ctx.node.networkId !== undefined ? 'subnetwork' : 'node').key
    }
    const size = Math.min(ctx.body.width, ctx.body.height) * SIZE_FACTOR
    this.cachedBounds = placeAttachment(ctx.body, 'center', size, size)
  }

  toPaintOp(_hovered: boolean): AttachmentPaintOp {
    return {
      kind: 'icons',
      layer: 'scene',
      bounds: this.cachedBounds,
      iconKey: this.iconKey,
    }
  }
}

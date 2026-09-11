/**
 * Node attachment Views — package-private.
 */

export { Attachment, type AttachmentValidateCtx } from './attachment.ts'
export { AlarmAttachment } from './alarm-attachment.ts'
export { IconsAttachment } from './icons-attachment.ts'
export { getIcon, registerIcon, type IconDefinition } from './icon-registry.ts'
export { LabelAttachment, Label2Attachment } from './label-attachment.ts'
export { estimateTextSize, placeAttachment } from './position.ts'
export { TooltipAttachment } from './tooltip-attachment.ts'
export type { AttachmentPaintLayer, AttachmentPaintOp } from './types.ts'

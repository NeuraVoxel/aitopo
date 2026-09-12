/**
 * Node and edge attachment Views — package-private.
 */

export {
  Attachment,
  isEdgeAttachmentCtx,
  isNodeAttachmentCtx,
  type AttachmentValidateCtx,
  type EdgeAttachmentValidateCtx,
  type NodeAttachmentValidateCtx,
} from './attachment.ts'
export { AlarmAttachment } from './alarm-attachment.ts'
export { EdgeAlarmAttachment } from './edge-alarm-attachment.ts'
export { EdgeLabelAttachment, EdgeLabel2Attachment } from './edge-label-attachment.ts'
export { EdgeTooltipAttachment } from './edge-tooltip-attachment.ts'
export { IconsAttachment } from './icons-attachment.ts'
export { getIcon, registerIcon, type IconDefinition } from './icon-registry.ts'
export { LabelAttachment, Label2Attachment } from './label-attachment.ts'
export { estimateTextSize, placeAttachment } from './position.ts'
export { placeAlongPath, samplePolylineAt } from './path.ts'
export { TooltipAttachment } from './tooltip-attachment.ts'
export type { AttachmentPaintLayer, AttachmentPaintOp } from './types.ts'

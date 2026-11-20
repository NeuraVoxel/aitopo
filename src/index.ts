/**
 * @neuravoxel/aitopo — dual-face Canvas topology engine for AI graphs.
 */

export type {
  Alarm,
  AlarmLevel,
  AttachmentPosition,
  EdgeArrowShape,
  EdgeCorner,
  EdgeLabelSide,
  EdgeLoopedDirection,
  EdgeLoopedType,
  EdgeRoute,
  EdgeShapeKind,
  GraphChromeStyle,
  GraphDocument,
  GraphEdge,
  GraphEdgeArrowStyle,
  GraphEdgeStyle,
  GraphGroup,
  GraphGroupStyle,
  GraphMeta,
  GraphNode,
  GraphNodeStyle,
  GraphShadowStyle,
  GraphTextStyle,
  GraphViewport,
  GraphEvent,
  GraphPatch,
  GraphPatchOp,
} from './protocol/index.ts'

export {
  parseDocument,
  applyPatch,
  invertOp,
  invertPatch,
  PatchHistory,
  graphDocumentSchema,
  graphPatchSchema,
} from './protocol/index.ts'

export { GraphScene } from './model/index.ts'
export { Network, Viewport, contentBounds, MIN_ZOOM, MAX_ZOOM } from './network/index.ts'
export { Canvas2DRenderer } from './render/index.ts'
export type { Renderer, ViewportState } from './render/index.ts'
export { getIcon, registerIcon } from './ui/attachment/icon-registry.ts'
export type { IconDefinition } from './ui/attachment/icon-registry.ts'
export {
  EXTERNAL_DROP_MIME_AITOPO,
  EXTERNAL_DROP_MIME_PLAIN,
  CreateEdgeInteraction,
  DeleteEdgeInteraction,
  ExternalDropInteraction,
  MarqueeSelectInteraction,
  MoveEdgeBendInteraction,
  MoveNodeInteraction,
  ResizeNodeInteraction,
  PanZoomInteraction,
  SelectActivateInteraction,
  type CreateEdgeInteractionOptions,
  type EdgeRubberBand,
  type Interaction,
  type InteractionBusHost,
  type InteractionCameraHost,
  type InteractionChromeHost,
  type InteractionEditHost,
  type InteractionHitHost,
  type InteractionHost,
  type InteractionQueryHost,
  type InteractionSelectionHost,
  type MoveNodeInteractionOptions,
  type OverlayChrome,
} from './interaction/index.ts'
export { layoutGrid, layoutFlowColumns } from './layout/index.ts'
export type { Point, Rect } from './geom.ts'
export { unionRect, hitRect, intersectsRect, containsRect, growRect } from './geom.ts'

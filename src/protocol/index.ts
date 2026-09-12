/**
 * Protocol public surface for AITopo.
 */

export type {
  Alarm,
  AlarmLevel,
  AttachmentPosition,
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
} from './types.ts'

export type {
  AlarmChangedEvent,
  DocumentChangedEvent,
  EdgeCreatedEvent,
  EdgeRemovedEvent,
  ExternalDropEvent,
  GraphEvent,
  GroupMembershipChangedEvent,
  HoverChangedEvent,
  LayoutCompletedEvent,
  NodeActivatedEvent,
  NodeMovedEvent,
  NodeResizedEvent,
  SelectionChangedEvent,
  SubNetworkChangedEvent,
  ViewportChangedEvent,
} from './events.ts'

export { parseDocument } from './parse.ts'
export { applyPatch, type GraphPatch, type GraphPatchOp } from './patch.ts'
export { invertOp, invertPatch } from './invert.ts'
export { PatchHistory } from './patch-history.ts'
export { graphDocumentSchema, graphPatchSchema } from './schema.ts'

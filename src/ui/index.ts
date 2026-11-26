/**
 * UI helper exports (package-private Views; public API stays on Network).
 */

export {
  complementaryElbow,
  DEFAULT_H,
  DEFAULT_W,
  edgeAnchors,
  edgeAnchorsAuto,
  edgeAnchorsFromRects,
  groupBounds,
  hitTestEdges,
  hitTestGroups,
  hitTestNodes,
  isHorizontalSide,
  isVerticalSide,
  nodeBounds,
} from './bounds.ts'
export type { EdgeAnchorSide, OrthogonalAnchorSide } from './bounds.ts'
export {
  collapsedGroupForNode,
  computeExpandedBandBounds,
  computeGroupBandBounds,
  collapsedOriginForCenter,
  DEFAULT_GROUP_PADDING,
  expandCollapseCenterPatches,
  findGroupForNode,
  findGroupForShapeNode,
  isGroupExpanded,
  isGroupVisibleInScene,
  isNodeVisibleInScene,
  listChildGroups,
  listDescendantGroupIds,
  listDescendantNodeIds,
  listGroupMembers,
  listGroupShapeNodes,
  listOwningGroupChain,
  listOwningGroupChainForShapeNode,
  type MemberBoundsResolver,
  type ShapeNodeBoundsResolver,
  memberUnionBounds,
  parentGroupOf,
  rectCenter,
  shapeNodePointBounds,
} from './group-state.ts'
export {
  endpointExistsInMaps,
  resolveEdgeEndpoint,
  type EdgeEndpoint,
} from './edge-endpoint.ts'
export { EdgeView } from './edge-view.ts'
export { GroupView } from './group-view.ts'
export { NodeView } from './node-view.ts'
export { buildPathPolyline, densifyControlPolyline } from './path-route.ts'
export { PathView } from './path-view.ts'
export { ShapeNodeView } from './shape-node-view.ts'
export { ViewSet } from './view-set.ts'

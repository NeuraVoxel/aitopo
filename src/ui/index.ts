/**
 * UI helper exports (package-private Views; public API stays on Network).
 */

export {
  DEFAULT_H,
  DEFAULT_W,
  edgeAnchors,
  edgeAnchorsAuto,
  edgeAnchorsFromRects,
  groupBounds,
  hitTestEdges,
  hitTestGroups,
  hitTestNodes,
  nodeBounds,
} from './bounds.ts'
export {
  collapsedGroupForNode,
  computeGroupBandBounds,
  DEFAULT_GROUP_PADDING,
  findGroupForNode,
  isGroupExpanded,
  isNodeVisibleInScene,
} from './group-state.ts'
export { EdgeView } from './edge-view.ts'
export { GroupView } from './group-view.ts'
export { NodeView } from './node-view.ts'
export { ViewSet } from './view-set.ts'

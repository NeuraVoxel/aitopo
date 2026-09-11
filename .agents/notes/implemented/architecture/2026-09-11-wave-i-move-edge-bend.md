# Agent Note: Wave I Move-edge bend waypoints

Status: implemented

## Problem

Orthogonal edges always used auto HV/VH routes from node boxes. Editors could not drag bend points (twaver MoveLink / link-handler idea), and the protocol had no place to store intermediate points, so routes could not persist or undo after an edit.

## Decision

Wave I adds optional edge bend waypoints end-to-end:

1. **Protocol** — `GraphEdge.waypoints?: { x, y }[]` are intermediate points only. Absent or `[]` means auto orthogonal routing. `updateEdge` merge clears on empty array; invert round-trips `waypoints` (missing prior → `[]`). Event `edgeWaypointsChanged` carries `{ edgeId, from, to }`.
2. **Routing** — `edgeAnchors(from, to, waypoints?)` always recomputes endpoint anchors from node boxes; non-empty waypoints yield `[fromAnchor, ...waypoints, toAnchor]`. `EdgeView.validate` passes `edge.waypoints`.
3. **GestureEditor** — `previewEdgeWaypoints` / `commitEdgeWaypoints` write via `GraphScene.writeEdgeWaypoints` (preview) and `updateEdge` + emit (commit). Dirty rects follow Wave F old∪new edge geometry.
4. **Interaction** — `MoveEdgeBendInteraction` paints bend handles on selected edges (`Renderer.drawEdgeBendHandle`), seeds waypoints from the auto polyline’s interior vertices on first drag, and moves handles with axis constraints. Pack before `MoveNodeInteraction`. Clean-room name (not twaver `MoveLinkInteraction`).

### Deferred (not Wave I)

Freeform (non-orthogonal) polylines; ShapeLink; rotate; CommitSink; multi-edge bundle editing; AITopoHost packing of bend interaction (demo packs it; host can follow when product needs).

## Alternatives considered

- **Store full polyline including endpoints:** rejected — endpoints must track node boxes; storing them would desync on move/resize.
- **Freeform drag without axis constraint:** rejected — paint style is orthogonal; freeform is ShapeLink scope.
- **Clone twaver MoveLinkInteraction name/API:** rejected — clean-room rename to `MoveEdgeBendInteraction`.

## Consequences

- Documents may carry `waypoints`; hosts that ignore the field keep auto routes.
- Out-of-tree `Renderer` implementers must provide `drawEdgeBendHandle`.
- Undo of bend edits works through existing `PatchHistory` + invert of `updateEdge.waypoints`.

## Testing

- Protocol parse / invert with waypoints; empty array clears.
- `edgeAnchors` auto vs waypoint path.
- GestureEditor commit emits `edgeWaypointsChanged` and persists in `toJSON`.
- `MoveEdgeBendInteraction` select → drag handle → commit (fake host).
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

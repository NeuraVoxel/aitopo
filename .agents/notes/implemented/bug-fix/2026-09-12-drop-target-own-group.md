# Agent Note: Drop-target feedback highlights the group itself via the selection path

Status: implemented

## Problem

Dragging a node inside its own group painted a constant green rectangle over the group. `MoveNodeInteraction.updateDropTarget` highlighted whichever group sat under the pointer (`hitTestGroupScreen`), with no check whether dropping there would change anything — so dragging within the owning group highlighted that same group for the whole drag, even though the drop is a membership no-op. Separately, the highlight itself was a dedicated green rect (`drawDropTargetHighlight`, `#22c55e` fill) drawn beside the group's own chrome — foreign to the canvas's interaction language and hard to read as "drop here".

## Decision

Two changes, one behavior: dragging over a group that would actually take a member now highlights that group exactly the way selection does.

- `updateDropTarget` treats a candidate group as a drop target only when at least one node mover would join it — membership checked via both sources (`node.groupId` and `group.memberIds`, mirroring `findGroupForNode`). The commit path is unchanged (`commitNodeMove` already no-ops membership when unchanged).
- The overlay chrome paints the target with `renderer.drawSelectionOverlay(band, group.style.select)` — the same call the selection pass uses — over the group's live band bounds. `InteractionQueryHost` gains `getGroupBandBounds(id)` (validated, auto-fit aware), implemented by `Network` from the `GroupView`. The dedicated `Renderer.drawDropTargetHighlight` method is deleted; the drop state no longer owns a painting style of its own.

## Alternatives considered

**Restyle the dedicated method (blue ring) but keep it.** Rejected by the user: still an extra frame beside the group rather than the group lighting up, and a second style definition to keep in sync.

**Filter at commit only (keep painting, skip the patch).** The patch was already a no-op; the defect was visual noise, so the fix belongs where the highlight is chosen.

**Keep green but lighter.** Any green remains foreign to the blue interaction palette.

## Consequences

In-group drags show no drop-target chrome; dropping over a group it does not belong to paints that group with its own selection chrome (default blue ring, custom `select` styles honored — the group looks selected). `getGroupBandBounds` joins the host query facet, so future gesture chrome can reuse validated band geometry. The `Renderer` surface shrinks by one method; custom renderers implementing the interface lose a required method (source-compatible for the default renderer consumers in this pre-1.0 package).

## Testing

`tests/move-node.spec.ts`: "does not highlight the group a dragged node already belongs to" and "highlights when at least one selected mover would join the group" pin the membership filter, counting `drawSelectionOverlay` calls from the drag chrome; red-green verified against the interaction change. All other `Renderer` mocks updated for the removed method; full suite and typecheck pass.

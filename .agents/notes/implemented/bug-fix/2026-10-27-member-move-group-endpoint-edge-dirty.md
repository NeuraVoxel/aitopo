# Agent Note: Member drag refreshes group-endpoint edges

Status: implemented

## Problem

Dragging a node inside an expanded Group updated the auto-fit band, but edges whose `from`/`to` were the **group id** kept their previous route until a full invalidate. `markNodeGeometryDirty` dirtied the group view and member-incident edges only.

## Decision

`markNodeGeometryDirty` walks `listOwningGroupChain` (owning group + `parentId` ancestors), dirties those group views, and dirties edges whose endpoints are those group ids. `GestureEditor` preview captures the same group-endpoint edge rects (and ancestor bands) for dirty-rect paint so strokes do not ghost.

## Alternatives considered

**Only dirty when `markGroupGeometryDirty` runs (expand/collapse / group drag).** Rejected: member drag is the common path that changes band bounds without that call.

**Always `dirty.markAll` on member preview.** Rejected: heavier than capturing the affected edge/band rects already used for auto-fit bands.

## Consequences

Group↔node / Group↔Group edges re-anchor live while members move. Nested parents that auto-fit around a child band also refresh.

## Testing

`tests/view-set.spec.ts` — group-endpoint route updates after member move. `tests/gesture-editor.spec.ts` — preview dirty union covers old/new group-edge paths.

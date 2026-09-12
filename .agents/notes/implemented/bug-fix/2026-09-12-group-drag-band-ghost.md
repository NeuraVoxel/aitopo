# Agent Note: Node preview inside auto-fit group dirties band old/new rects

Status: implemented

## Problem

Dragging (or resizing) a node inside an expanded group left rendering ghosts. Expanded groups default to `autoFit` (`computeGroupBandBounds` recomputes the band from live member positions on every validate), so the band follows the dragged node each frame. `GestureEditor.previewNodeGeometry` only added the node's and incident edges' old/new rects to the dirty accumulator, and `Network.validate` repaints clipped to that union — the band's old and new areas were never repainted, leaving stale band pixels (残影) along the band trail.

## Decision

`GestureEditor.previewNodeGeometry` now captures `growRect(bounds, 8)` of every group view the node belongs to (`groupId` ∪ `memberIds`, mirroring `ViewSet.markNodeGeometryDirty`) both before the mutation and after `validateDirty`, and adds those rects to the dirty accumulator alongside the node/edge rects. The shared helper covers node move preview and node resize preview (both route through `previewNodeGeometry`). The commit path needed no change: `Network.syncDirtyFromScene` already captured group view rects.

## Alternatives considered

**`dirty.markAll()` during any member preview.** Correct but repaints the full scene every pointermove frame — the dirty-rect pipeline exists precisely to avoid that during drags.

**Deriving the clip generically from all invalidated Views.** Would fix the class of bugs rather than this instance, but it reworks the View/dirty handshake across every preview path; the targeted capture follows the existing `captureNodeGeometryRects` pattern at negligible cost.

## Consequences

Dragging or resizing a member of an auto-fit band repaints the band's old and new footprints; fixed-size bands (`autoFit: false`, collapsed) add a no-op duplicate rect. Previews of ungrouped nodes are unchanged.

## Testing

`tests/gesture-editor.spec.ts` "preview move inside an auto-fit band dirties the band old and new rects" asserts the dirty union contains the grown corners of both the pre-move and post-move band; verified red without the fix and green with it.

# Agent Note: Wave F apply and preview dirty granularity

Status: implemented

## Problem

Wave E stopped chrome/selection/hover from rebaking the root canvas, but content mutations still paid full-frame cost. `GraphScene.commitActive(false)` marked every node/edge/group id dirty after each `apply`, and `Network.previewNodePosition` / `previewNodeBounds` always called `DirtyAccumulator.markAll()`. `syncDirtyFromScene` also unioned only post-validate bounds, so a true partial clip would leave stale pixels where geometry vacated.

## Decision

Wave F narrows scene dirty tracking without changing Document / Patch / Events:

1. **Op→id dirty on apply** — `commitActive` no longer dirties every element when `full` is false. `apply` collects ids from patch ops against the pre-apply document (including cascaded edges on `removeNode` / incident edges on `updateNode`). `setViewport` sets `invalidateAll`. Selection-only ops add no scene dirty ids.
2. **Old∪new bounds in `syncDirtyFromScene`** — Capture active View bounds for dirty ids **before** `views.sync` (so removals keep a rect), then after validate union old and new grown bounds into `DirtyAccumulator`.
3. **Preview without `markAll`** — `previewNodePosition` / `previewNodeBounds` capture node + incident-edge old rects, write scene geometry, validate, union old∪new, and `scheduleScenePaint`. Drag paint filter still forces scene `'all'`.

Execution checklist: [Wave F plan](../../../../docs/2026-09-11-aitopo-wave-f-dirty-granularity.md).

### Deferred (not Wave F)

View label/alarm/hit facets (Wave G); InteractionHost split (Wave H); lazy-move default; rotate / move-link.

## Alternatives considered

- **Keep dirty-all on every apply:** rejected — patch streams and editor commits would never benefit from Wave E’s root clip path.
- **Diff entire before/after documents by deep equality:** rejected — op walk is cheaper and matches the structural patch model.
- **Pixel hit-test / Attachment tree for dirty facets:** rejected — out of scope; geometry ids suffice.
- **twaver property-change firehose:** rejected — clean-room; AITopo stays on Patch / preview write paths.

## Consequences

- Single-node `apply` / live drag preview can paint with a dirty-rect clip when the drag paint filter is off.
- Removals still erase correctly because old View rects are captured before View sync drops them.
- Hosts that relied on every apply forcing a full clear may see partial updates; camera/resize/load/nav behavior is unchanged.
- `debugPaintRects` red strokes become meaningful for preview and small patches.

## Testing

- `tests/scene-graph.spec.ts` — apply dirty id set / setViewport invalidateAll.
- `tests/paint-channels.spec.ts` — preview schedules non-`'all'` scene dirty when filter is clear.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

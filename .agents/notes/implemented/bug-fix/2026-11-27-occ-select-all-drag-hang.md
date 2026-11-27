# Agent Note: OCC select-all drag hang

Status: implemented

## Problem

ADAS OCC (~4k occupancy GraphNodes) froze the page when the host selected all cells and dragged. Each `pointermove` called `previewNodePosition` once per selected id. Every call rebuilt the follow-host index (`listTransitiveFollowers` / `translateFollowersLive` scanned the whole node map) and ran `validateDirty`, so cost was ≈ O(N²) per move on a graph with no follow edges.

## Decision

1. **Batch preview** — `previewNodePositions` on GestureEditor / Network; `MoveNodeInteraction` sends one batch per frame. One `writePositions`, one follower-index build, one `validateDirty`, one schedule. Batches larger than `MAX_PARTIAL_DIRTY_ABSORBS` use `dirty.markAll()` instead of per-mover rect capture.
2. **Shared follow index on write** — `translateHostMovesLive` builds the host→followers map once per `writePositions` / `writeBounds` / `writeGroupPositions` batch; empty index short-circuits.
3. **Bulk UI cap (`BULK_SELECTION_UI_CAP` = 64)** — when movers/selection exceed the cap: force lazy drag (no live write/validate), one union AABB ghost, one union selection ring on overlay (not N rings), `commitNodeMoves` one GraphPatch, `syncDirtyFromScene` falls through to `markAll`, and skip N× `nodeMoved` emits.

## Alternatives considered

- **Only batch live preview:** insufficient — OCC still froze on N overlay selection rings per frame and N× `commitNodeMove` / dirty capture on pointer-up.
- **Spatial index / skip validateDirty:** deferred — not required once preview is lazy at bulk size; roadmap Wave M remains for hit.
- **Cap selection size in the stress demo:** rejected — the engine must tolerate bulk selection; hang was an engine bug (stress catalog now Elements **Perf**).

## Consequences

- Multi-select drag below the cap stays live-preview; above it is lazy + batch commit.
- Single-node preview still uses the existing path (batch of one).
- Bulk select-all budgets now run on Elements **Perf** (`tests/perf-select-all-drag.spec.ts`); OCC is the ADAS occupancy sample ([perf grid](../feature/2026-11-27-elements-perf-grid-sample.md)).
- Pointer-up freeze after batch commit (apply/invert/`PatchHistory`) is covered by [OCC select-all commit release](2026-11-27-occ-select-all-commit-release.md).


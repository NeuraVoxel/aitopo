# Agent Note: Wave A View cache, injectable Renderer, alarmChanged

Status: proposed

## Problem

The design names a Scene + View layer with `markDirty → validate → paint`, but the implementation rebuilds ephemeral paint structs inside `Network.validate()` every frame. Dirty-rect unions and hit-test therefore do not share a cached geometry owner. Overlay chrome is gated with `instanceof Canvas2DRenderer`, so the `Renderer` interface is not actually swappable. The protocol defines `alarmChanged`, yet `Network.apply` never emits it after `setAlarms`, so hosts cannot observe alarm mutations without re-reading the document.

## Proposal

Ship Wave A as three coupled engine changes without altering the Document / Patch / Events dual-face model or importing SDK2D:

1. **Views** — Package-private `NodeView` / `EdgeView` / `GroupView` plus a `ViewSet` that syncs to `GraphScene`, caches world geometry via existing `src/ui/bounds.ts` helpers, and validates only when dirty. Selection and hover remain scene-owned chrome flags passed into `toPaintView(...)` at paint time. View classes stay out of the public barrel.
2. **Renderer injection** — Widen `Renderer` with overlay methods (`drawSelectionOverlay`, `drawMarquee`, `drawEdgeRubberBand`). Add `NetworkOptions.createRenderer`. Default remains `Canvas2DRenderer`. Remove `instanceof Canvas2DRenderer` from `Network.validate`.
3. **alarmChanged** — After a successful `scene.apply`, emit one `alarmChanged` per `setAlarms` op using `scene.alarmsOf(elementId)` as the payload. Continue emitting `documentChanged`. Do not emit on bare `load` in this wave.

Execution checklist (file map, task steps, commits): [Wave A implementation plan](../../../docs/2026-09-10-aitopo-wave-a-view-renderer-alarms.md). That plan is not the decision home; this Agent Note is. When the wave ships, move this note to `implemented/architecture/`, rewrite `## Proposal` into present-tense `## Decision`, and fold acceptance/risks into `## Consequences` / `## Testing`.

### Deferred (not Wave A)

Overlay marker protocol, lazy-move ghost, drop-target group highlight, resize/rotate handles, Attachment tree, pixel hit-test, Logical/Mixed zoom, Overview, HTML UI.

## Alternatives considered

- **Keep ephemeral PaintViews only:** rejected — dirty-rect, hit-test, and a future non-Canvas renderer would keep recomputing and diverging from one geometry owner.
- **Clone twaver ElementUI / attachment naming and lifecycle:** rejected — clean-room rule forbids twaver public names and an Attachment tree is an explicit non-goal.
- **Property-change listeners for alarms (UndoManager style):** rejected — AITopo notifies through `GraphEvent`; `setAlarms` is the durable mutation path.
- **Ship only `alarmChanged` and defer Views:** rejected as the sole Wave A — the emit is worth an early PR slice, but leaving View extraction open keeps the Phase-1 design gap; the wave still allows splitting PRs with Views as the main architecture change.

## Acceptance criteria

- `network.apply({ ops: [{ op: 'setAlarms', ... }] })` emits `alarmChanged` with post-apply `scene.alarmsOf` contents, and still emits `documentChanged`.
- `NetworkOptions.createRenderer` can supply a fake `Renderer`; default mount still uses `Canvas2DRenderer`.
- `Network.validate` never branches on `instanceof Canvas2DRenderer`.
- Element geometry for paint and dirty-rect union goes through `ViewSet` after validate; public exports still omit View classes and twaver names.
- Gap backlog marks View extract and `alarmChanged` as `done`; `pnpm test`, `pnpm run typecheck`, and `pnpm run verify-notes` pass for the change set.

## Risks

- View sync bugs on add/remove/preview-move can desync paint from the scene; mitigate with `ViewSet` unit tests and existing network/editor helper regressions.
- Widening `Renderer` breaks any out-of-tree implementers (none expected in-repo today); keep methods total on the interface with Canvas2D providing real draws.
- Caching geometry while selection/hover change every frame is easy to get wrong if chrome flags are stored on Views; keep those flags off the View cache.

# Agent Note: Wave A View cache, injectable Renderer, alarmChanged

Status: implemented

## Problem

The design names a Scene + View layer with `markDirty → validate → paint`, but the implementation rebuilt ephemeral paint structs inside `Network.validate()` every frame. Dirty-rect unions and paint therefore did not share a cached geometry owner. Overlay chrome was gated with `instanceof Canvas2DRenderer`, so the `Renderer` interface was not actually swappable. The protocol defined `alarmChanged`, yet `Network.apply` never emitted it after `setAlarms`.

## Decision

Wave A ships three engine changes without altering the Document / Patch / Events dual-face model or importing SDK2D:

1. **Views** — Package-private `NodeView` / `EdgeView` / `GroupView` in `src/ui/` plus `ViewSet` synced to `GraphScene`. Views cache world geometry via `src/ui/bounds.ts` and validate only when dirty. Selection and hover remain scene-owned chrome flags passed into `toPaintView(...)` at paint time. View classes are not public barrel exports.
2. **Renderer injection** — `Renderer` includes overlay methods (`drawSelectionOverlay`, `drawMarquee`, `drawEdgeRubberBand`). `NetworkOptions.createRenderer` (resolved by `resolveRenderer`) supplies the backend; default is `Canvas2DRenderer`. `Network.validate` does not use `instanceof Canvas2DRenderer`.
3. **alarmChanged** — After a successful `scene.apply`, Network emits one `alarmChanged` per `setAlarms` op with `scene.alarmsOf(elementId)`, then `documentChanged`. Bare `load` does not emit `alarmChanged`.

Execution checklist (historical task steps): [Wave A implementation plan](../../../docs/2026-09-10-aitopo-wave-a-view-renderer-alarms.md).

### Deferred (not Wave A)

Overlay marker protocol, lazy-move ghost, drop-target group highlight, resize/rotate handles, Attachment tree, pixel hit-test, Logical/Mixed zoom, Overview, HTML UI. Hit-test still uses `ui/bounds` helpers rather than View bounds exclusively.

## Alternatives considered

- **Keep ephemeral PaintViews only:** rejected — dirty-rect, hit-test, and a future non-Canvas renderer would keep recomputing and diverging from one geometry owner.
- **Clone twaver ElementUI / attachment naming and lifecycle:** rejected — clean-room rule forbids twaver public names and an Attachment tree is an explicit non-goal.
- **Property-change listeners for alarms (UndoManager style):** rejected — AITopo notifies through `GraphEvent`; `setAlarms` is the durable mutation path.
- **Ship only `alarmChanged` and defer Views:** rejected as the sole Wave A — the emit shipped in an early commit, but View extraction closes the Phase-1 design gap.

## Consequences

- Paint and dirty-rect unions go through `ViewSet` after validate; hosts can inject a fake `Renderer` in tests without Canvas2D.
- Out-of-tree `Renderer` implementers must provide the new overlay methods (none in-repo besides `Canvas2DRenderer`).
- Selection/hover chrome is not cached on Views, so chrome-only updates do not force geometry revalidation.
- Wave B items remain open only where marked `later` / unchecked in the gap backlog (Shift-append marquee, resize/rotate, move-link).

## Testing

- `tests/alarm-events.spec.ts` — `setAlarms` emits `alarmChanged` + `documentChanged`.
- `tests/network-renderer.spec.ts` — `resolveRenderer` honors `createRenderer`.
- `tests/view-set.spec.ts` — rebuild/sync, incident-edge dirty, validate idempotency.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

# Agent Note: Withdraw preview skip-expand (restore residual safety)

Status: implemented

## Problem

[Partial dirty flood cap](../architecture/2026-11-27-partial-dirty-flood-cap.md) skipped `expandPartialDirty` on live preview so drag would not snowball the dirty hole. The seed (mover ∪ edge AABB ∪ far endpoint) still `clearRect`s through any neighbor that intersects that hole; without neighbor expand those neighbors are only redrawn inside the clip, leaving AA / shadow / rotated-ink residuals — the same class of defect [neighbor expand](./2026-11-26-partial-dirty-neighbor-expand.md) and [far-endpoint residual](./2026-11-20-far-endpoint-dirty-residual.md) fixed.

## Decision

Withdraw preview skip-expand. `GestureEditor` preview paths again schedule a normal scene paint so `expandPartialDirty` runs. The absorb cap (`MAX_PARTIAL_DIRTY_ABSORBS` → `'all'`) from the flood-cap note **remains**. Remove the unused `expandDirtyNeighbors` schedule flag.

Does not change Document / Patch / Events. Lift-to-overlay drag (freeze root, live movers on overlay) stays a later performance follow-up, not this fix.

Supersedes decision item 1 (preview skip-expand) of [partial dirty flood cap](../architecture/2026-11-27-partial-dirty-flood-cap.md); item 2 (absorb cap) is unchanged.

## Alternatives considered

- **Keep skip-expand and tolerate residuals:** rejected — visible ghosts on overlapping / corridor neighbors during every live drag.
- **Depth-1 expand only on preview:** rejected for this fix — still grows the clear hole through full first-hop bounds; residual safety without the known full expand path needs more proof than a regression patch.
- **Lift-to-overlay in this change:** rejected — correct long-term drag cost model, but larger architecture than restoring expand + cap.

## Consequences

- Live preview again expands intersecting neighbors into the dirty hole (and may `'all'` when absorb exceeds the cap).
- Drag on dense overlap graphs may full-frame during preview; sparse graphs keep partial clip with correct clears.
- Hosts no longer see skip-expand seam regressions from the flood-cap preview path.

## Testing

- `tests/paint-channels.spec.ts` — absorb-cap → `'all'` retained; skip-expand corridor assertion removed; far-endpoint and overlapping-neighbor expand cases remain.

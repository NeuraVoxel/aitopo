# Agent Note: expandPartialDirty is opt-in (default off)

Status: implemented

## Problem

`expandPartialDirty` scans every element for each partial paint to flood-absorb intersecting neighbors. On dense graphs (OCC multi-select, large dirty seeds) that O(n) pass runs every frame even when the host already batch-lazies movers — paying expand cost without needing neighbor seams for the stress path.

## Decision

`NetworkOptions.expandPartialDirty` (and `setExpandPartialDirty`) gates the flood. **Default is now `true`** — see [expandPartialDirty defaults on](./2026-11-27-expand-partial-dirty-default-on.md), which supersedes the default-off choice below. The gate itself remains: **`false`** keeps `growRect(seed, DIRTY_SEED_AA_GROW)` only; **`true`** runs neighbor union + absorb cap → `'all'`. Seeds still use baked `paintBounds` and far-endpoint seeding when those paths run.

## Alternatives considered

- **Delete expand entirely:** rejected — ADAS pulse / overlapping chrome still need the expand path for residual-free partial clears ([neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md)).
- **Default on, disable only above bulk cap:** recorded as rejected when this note shipped default-off; later superseded by [defaults on](./2026-11-27-expand-partial-dirty-default-on.md) (sample/host `false` for dense paths).

## Consequences

- Gate API stays; default and demo wiring follow [defaults on](./2026-11-27-expand-partial-dirty-default-on.md).
- Related: [partial dirty absorb cap](./2026-11-27-partial-dirty-flood-cap.md), [view paintBounds dirty](./2026-11-27-view-paint-bounds-dirty.md).


# Agent Note: expandPartialDirty defaults on

Status: implemented

## Problem

[expandPartialDirty opt-in](./2026-11-27-expand-partial-dirty-opt-in.md) defaulted the neighbor flood off so OCC-scale paints skipped an O(n) expand. That left ordinary sparse edits with AA / shadow / rotated-ink seams unless every host remembered to turn the switch on. Product preference is residual-free partials by default; only dense stress paths should opt out.

## Decision

`NetworkOptions.expandPartialDirty` defaults to **`true`** (`options.expandPartialDirty !== false`). Pass **`false`** for AA-grow-only on dense stress hosts. Demo: property-panel checkbox defaults checked; Elements **Perf** (`elements-perf-grid`) sets `DemoSample.expandPartialDirty: false` on mount. Supersedes the default-off choice in the opt-in note; the gate API itself stays.

## Alternatives considered

- **Keep default off:** rejected — sparse edit residuals are the common case; dense hosts can name the exception.
- **Auto-disable only above `BULK_SELECTION_UI_CAP`:** deferred — still useful later, but a sample/host `false` is enough for OCC now and keeps the switch explicit.

## Consequences

- Neighbor flood runs unless the host opts out; tests that assert AA-only pass `expandPartialDirty: false`.
- Perf Demo loads with expand off via sample metadata; leaving Perf restores the default on ([perf grid](../feature/2026-11-27-elements-perf-grid-sample.md)).
- Cross-links: [opt-in gate](./2026-11-27-expand-partial-dirty-opt-in.md), [neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md), [flood cap](./2026-11-27-partial-dirty-flood-cap.md).

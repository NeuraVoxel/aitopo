# Agent Note: View stats HUD and dense-paint quick wins

Status: implemented

## Problem

Dense node grids (~4k GraphNodes; stress path now Elements **Perf**) stuttered on pan / hover. Separately, hosts needed an on-canvas read of zoom and paint load while stress-testing. Twaver shows an ephemeral wheel zoom label, not a standing HUD or FPS.

## Decision

- **View stats HUD:** Network mounts a top-right HTML overlay (`Zoom x.xx` / `FPS n`) by default (`viewStatsVisible: false` to hide). FPS is the continuous rAF cadence (~display refresh when the tab is focused), refreshed about once per second.
- **`style.shadow: null`:** Nodes omit the engine default drop shadow when authors set explicit `null` (groups already had no default). Dense stress cells (Elements **Perf**) use this so unselected fills skip Canvas `shadowBlur`.
- **Hover short-circuit:** `setHover` no-ops when the id is unchanged.
- **Overlay paint:** Node/group overlay chrome builds `toPaintView` only for selected and hovered ids (not every node).
- **Viewport cull:** Scene draws skip elements whose bounds miss the camera world rect (padded), including full-frame (`'all'`) paints. Cull activates only when the view CSS size is real (`width`/`height` > 1); pre-layout 1×1 defaults skip cull so hosts and tests are not blank.

## Alternatives considered

- **Copy twaver ephemeral zoomDiv + Reset button:** rejected — product asked for standing top-right Zoom + FPS; clean-room HUD, not twaver API names.
- **Paint-only FPS (`validate()` count):** rejected after product feedback — idle looked like “0 until I move”; standing HUD should show the display/rAF maximum, with load visible as drops under heavy paint.
- **Turn off default node shadow globally:** rejected — would restyle every diagram; opt-out via `null` keeps defaults for normal cards.
- **Spatial hit index in this change:** deferred — hover equality + overlay trim + viewport cull + shadow opt-out are the first ladder; spatial hit remains roadmap Wave M. Dirty absorb cap shipped later in [partial dirty absorb cap](../architecture/2026-11-27-partial-dirty-flood-cap.md); preview skip-expand was withdrawn in [preview skip-expand withdrawn](../bug-fix/2026-11-27-preview-skip-expand-withdrawn.md).

## Consequences

- Protocol accepts `shadow: null` on node/group style; invert/clone preserve null.
- `elementPaintPad` no longer invents a default blur when the paint DTO has no shadow — callers must forward the resolved paint shadow (including the node default when it applies).
- Elements **Perf** stamps `shadow: null` and `select`/`hover` `glow: false` on every stress cell ([perf grid](./2026-11-27-elements-perf-grid-sample.md)); ADAS OCC keeps occupancy semantics without those dense opt-outs.
- Tests cover parse/null shadow, hover no-op, viewport cull, HUD visibility, and NodeView default vs null.

# Agent Note: SubNetwork navigation restores cameras both ways

Status: implemented

## Problem

Drilling into a SubNetwork (and host `fitContent` on enter) replaced the parent zoom / pan. Exiting rebuilt the parent but left the child framing (or fitted again). Re-entering a previously visited child also fitted from scratch, so users lost both the parent framing and the in-child framing they had before the last exit.

## Decision

`Network` keeps:

- **`cameraStack`** — each `enterSubNetwork` pushes the parent `{ x, y, zoom }`; each `exitSubNetwork` pops and applies it (parent restore).
- **`cameraByPath`** — keyed by the SubNetwork stack path; on exit, the current (child) camera is saved; on a later enter of the same path, that camera is restored before paint.

`subNetworkChanged` includes `direction: 'enter' | 'exit'` and `cameraRestored` (true when enter applied a saved path camera). `load` clears both stores. Nested enter/exit restore level-by-level.

**First visit:** when the view is sized (`width`/`height` > 1), `enterSubNetwork` calls `fitContent()` so the parent zoom is never left on the child. Topo host still re-fits on `enter && !cameraRestored` to apply skill `fitScale`. Pre-mount / headless enters skip the engine fit.

**Host ResizeObserver:** per-SubNetwork `meta` chrome can change topbar height and resize `#canvas`. On exit / restored re-enter the host adopts the new size into `lastFitW`/`lastFitH` without fitting, so the RO debounce does not call `fitIfSizeChanged` and undo camera restore.

## Alternatives considered

**Persist cameras into each document `viewport` on navigate.** Rejected: mutates authored docs and fights child-authored viewports; in-memory maps match the session stack.

**Host-only memory.** Rejected: every host would reimplement; engine enter/exit is the single navigation API.

**Host-only first-visit fit.** Rejected: leaving parent zoom until a host rAF fit races and fails open (parent framing sticks) when the host gate misses; engine fit is the reliable default.

## Consequences

Exit framing matches the pre-enter parent camera. Re-enter framing matches the last in-child camera. First visit fits in the engine (sized views) and again in the topo host for `fitScale`. Custom hosts that fit on every `subNetworkChanged` will undo restores — use `direction` / `cameraRestored`.

## Related

Builds on [multilevel SubNetwork stack](./2026-10-22-multilevel-subnetwork-stack.md).

## Testing

`tests/subnetwork-camera.spec.ts` — parent restore on exit; nested levels; re-enter restores child camera; `cameraRestored` flags; first enter fits when sized / keeps parent when unsized; `load` clears stale memory.

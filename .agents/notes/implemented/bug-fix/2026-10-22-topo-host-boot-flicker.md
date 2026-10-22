# Agent Note: Topo host hides until first fit (no boot flicker)

Status: implemented

## Problem

Opening a topo host page painted the Network at the default camera, then jumped after a double-`requestAnimationFrame` `fitContent`. A `ResizeObserver` debounce (~120ms) often fitted again after reveal, so the first visible frames flashed wrong framing / double-paint — noticeable on the three 智驾闭环 diagrams.

## Decision

Skill host only (`assets/host/host.js`); engine defaults unchanged.

- Conceal `#canvas` (`opacity: 0`, no pointer events) before mount when `fit !== false`.
- Double-rAF: fit → fit → reveal so flex layout settles under the blank frame.
- `fitIfSizeChanged`: ResizeObserver skips until reveal and skips when size equals the last fit size.
- Reset re-conceals, reloads, and runs the same schedule.

## Alternatives considered

**Fit synchronously in `boot` before the RAF loop paints.** Rejected as unreliable: flex `#canvas` often still has a stale size on the first sync tick; skill framing stays in the host.

**Engine option to defer first paint until `fitContent`.** Rejected: skill look-and-feel belongs in the host per `SKILL.md`; other Network consumers may want the default camera.

## Consequences

First visible frame is already fitted. Window resize still refits when dimensions change. Manual Fit / Reset behave as before (Reset briefly conceals again).

## Testing

Manual: hard-reload the three 智驾闭环 `diagram.html` pages — no zoom/pan jump on open; resizing the window still recenters.
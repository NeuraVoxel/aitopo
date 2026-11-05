# Agent Note: Twaver-parity multi-select and marquee

Status: implemented

## Problem

Relative to twaver.vector `DefaultInteraction`, aitopo only offered Shift-marquee of nodes (optional Ctrl-union at pointer-up) and plain click single-select. Missing: Ctrl/Cmd click toggle, Ctrl/Cmd empty marquee, group/edge marquee hits, XOR marquee semantics, drag-direction contain/intersect, and Ctrl/Cmd+A select-all.

## Decision

Align selection gestures with twaver while keeping unmodified empty-drag as pan:

1. **Ctrl/Cmd+click** — `SelectActivateInteraction` toggles the hit id in `selectedIds`. Plain click on an **unselected** hit replaces; plain click on an **already-selected** hit leaves the set alone so `MoveNodeInteraction` can drag the whole multi-select (twaver `DefaultInteraction`).
2. **Marquee start** — `Shift` **or** `Ctrl/Cmd` + empty drag (`MarqueeSelectInteraction`); `PanZoomInteraction` ignores those modifiers on empty space. Shift/Ctrl empty pointerdown does not clear selection (so Ctrl marquee can XOR).
3. **Marquee hits** — intersecting (or contained) **nodes, groups** (`getGroupBandBounds`), and **edges** (`Network#getEdgePathBounds` / path AABB).
4. **Marquee commit** — Ctrl/Cmd start → **XOR** into current selection; Shift-only start → **replace**. Drag up-and-left → contain mode; otherwise intersect (twaver default heuristic).
5. **Ctrl/Cmd+A** — select all node, group, and edge ids in the active network (ignores editable fields).

Supersedes the Ctrl-at-pointer-up **union** rule from [Wave C marquee append](../architecture/2026-09-10-wave-c-marquee-resize.md) for the XOR path; Shift-only replace remains.

## Alternatives considered

**Drop Shift-marquee; Ctrl-only like twaver.** Rejected: skill/host docs and muscle memory already use Shift-drag; both modifiers are supported.

**Always-XOR marquee.** Rejected: Shift-only replace matches “clear then band” when Ctrl is not held at start (twaver clears before non-Ctrl drag-to-select).

**Expose `selectMode` / `rectSelectFilter` API this wave.** Rejected: no callers; direction heuristic covers default twaver behavior.

## Consequences

Default and topo-host basic packs gain Ctrl multi-select without Edit mode. Hosts that assumed Ctrl+Shift marquee **union** (never remove) now see XOR. Custom hosts that clear on every empty pointerdown will still break Ctrl marquee. On macOS, `SelectActivate` / `MarqueeSelect` call `preventDefault` on Ctrl+`pointerdown` and Ctrl+`contextmenu` so the system menu does not steal the gesture; plain right-click menus (no Ctrl) are unchanged.

## Related

Builds on [default interaction set](./2026-09-12-default-interaction-set.md) and [Wave C marquee](../architecture/2026-09-10-wave-c-marquee-resize.md).

## Testing

`tests/marquee.spec.ts` — Shift replace; Ctrl start; group/edge hits; contain mode; XOR. `tests/select-activate.spec.ts` — Ctrl toggle; Ctrl+A; Ctrl+empty does not clear.

# Agent Note: Default interaction set matches twaver DefaultInteraction baseline

Status: implemented

## Problem

A freshly constructed `Network` only wired `PanZoomInteraction` + `SelectActivateInteraction` by default (`src/network/network.ts`, `attachInteractions`). Selecting was possible, but moving nodes/groups and marquee multi-select — the baseline twaver.vector `DefaultInteraction` provides out of the box — required every embedder to hand-assemble interaction lists (as `demo/lib/interactions.ts` did). "Default" meant observe-only-plus-click, which surprises anyone coming from twaver.

## Decision

When `defaultInteractions !== false` (the default), `Network.attachInteractions` mounts:

```
[PanZoomInteraction, SelectActivateInteraction, MoveNodeInteraction, MarqueeSelectInteraction]
```

in that order. User-supplied `interactions` still append after the defaults; `defaultInteractions: false` keeps its exact semantics (mount nothing, caller owns everything).

Defaults and gestures:

- **Pan/zoom** — wheel + drag via `PanZoomInteraction` (unchanged).
- **Select/activate** — click selects, double-click activates (nodes) or toggles group expand (groups) via `SelectActivateInteraction` (unchanged).
- **Move** — drag a selected node or group; unlocked only; drop onto a group reparents (`MoveNodeInteraction` with default options: live preview, full-scene paint).
- **Marquee** — Shift or Ctrl/Cmd + primary drag on empty space selects intersecting nodes/groups/edges (see [twaver selection parity](./2026-11-05-twaver-selection-parity.md)). Unmodified empty-space drag stays with pan.

The demo's `buildInteractions` no longer lists `MoveNodeInteraction` / `MarqueeSelectInteraction` in any mode; edit/create modes keep only their structural extras (move-path-vertex, move-shape-node-vertex, move-edge-bend, resize, delete-edge, create-edge, create-path, create-shape-node, external-drop). Observe mode now demonstrates the full default set.

## Alternatives considered

**Full editor set as default (resize, bend-drag, delete/create edge).** Rejected: those interactions mutate graph structure and assume an editing host; a library default that silently adds or removes edges is too aggressive. Editors opt in explicitly, as the demo does.

**`DefaultInteraction` composite with per-behavior options (`{ movable, editable, … }`) or a preset enum (`'basic' | 'editor' | false`).** Rejected for now: no current consumer needs the granularity, and it changes the `defaultInteractions` option type for everyone. The boolean + explicit opt-out covers the ask; a composite can be layered later without breaking it.

## Consequences

Embedders upgrading from observe-only defaults now get drag-move and Shift-marquee out of the box; callers wanting the old behavior pass `defaultInteractions: false` and assemble their own list. The pre-1.0 private package status makes this a release-note-grade change, not a compat break.

## Testing

`tests/default-interactions.spec.ts` (happy-dom, stub renderer) pins both branches against a real mounted `Network`: default-attached drag emits `nodeMoved` and moves the node; Shift-band drag emits `selectionChanged` with the covered ids (after the empty-space clear from SelectActivate); `defaultInteractions: false` emits neither and leaves geometry untouched.

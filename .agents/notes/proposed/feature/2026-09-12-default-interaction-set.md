# Agent Note: Default interaction set matches twaver DefaultInteraction baseline

Status: proposed

## Problem

A freshly constructed `Network` only wires `PanZoomInteraction` + `SelectActivateInteraction` by default (`src/network/network.ts`, `attachInteractions`). Selecting is possible, but moving nodes/groups and marquee multi-select — the baseline twaver.vector `DefaultInteraction` provides out of the box — require every embedder to hand-assemble interaction lists (as `demo/lib/interactions.ts` does). "Default" currently means observe-only-plus-click, which surprises anyone coming from twaver.

## Proposal

Grow the default set mounted when `defaultInteractions !== false` to:

```
[PanZoomInteraction, SelectActivateInteraction, MoveNodeInteraction, MarqueeSelectInteraction]
```

Order follows the arrangement already exercised by the demo's edit mode (`MoveNodeInteraction` before `MarqueeSelectInteraction`). User-supplied `interactions` still append after the defaults; `defaultInteractions: false` keeps its exact semantics (mount nothing, caller owns everything).

Deduplicate the demo: `buildInteractions('edit')` drops its `MoveNodeInteraction` and `MarqueeSelectInteraction` entries (now defaults), keeping only edit-mode extras (move-edge-bend, resize, delete-edge, create-edge, external-drop). Update the surrounding comment to name the default set.

## Alternatives considered

**Full editor set as default (resize, bend-drag, delete/create edge).** Rejected: those interactions mutate graph structure and assume an editing host; a library default that silently adds or removes edges is too aggressive. Editors opt in explicitly, as the demo does.

**`DefaultInteraction` composite with per-behavior options (`{ movable, editable, … }`) or a preset enum (`'basic' | 'editor' | false`).** Rejected for now: no current consumer needs the granularity, and it changes the `defaultInteractions` option type for everyone. The boolean + explicit opt-out covers the ask; a composite can be layered later without breaking it.

## Acceptance criteria

- Default-constructed Network: dragging a node emits `nodeMoved` (via preview + commit); dragging empty canvas produces a marquee selection; Ctrl+click appends to selection; wheel/drag pan still works.
- `defaultInteractions: false`: none of the above fire; only caller-supplied interactions run.
- `buildInteractions('edit')` produces no duplicate mounting of move/marquee (demo behavior unchanged in effect).
- New spec (e.g. `tests/default-interactions.spec.ts`) covers both branches; `pnpm test` and `pnpm typecheck` pass.

## Risks

- Embedders relying on "default = no move" see behavior change on upgrade (this is a pre-1.0 private package; release note suffices).
- Marquee on empty-canvas drag removes the ability to pan by dragging empty space with the left button; pan remains available via wheel/other PanZoom affordances exactly as today's default — no regression, but worth stating.

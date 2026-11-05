# Agent Note: Wave C marquee append and node resize

Status: implemented

## Problem

Marquee selection always replaced the current selection, so hosts could not add a rect-select set to an existing multi-select without clearing first. Nodes expose `w` / `h` in the protocol but there was no interaction to resize them.

## Decision

Wave C ships two editor interaction upgrades on Wave A/B chrome and Views:

1. **Marquee append** — Shift+empty marquee still opens the gesture; at pointer-up, if **Ctrl** or **Meta** is held, union intersecting node ids with the current selection; otherwise replace. Shift still means marquee vs pan. *(Later superseded for Ctrl-start XOR + group/edge hits by [twaver selection parity](../feature/2026-11-05-twaver-selection-parity.md).)*
2. **Node resize** — `ResizeNodeInteraction` paints four corner handles (via overlay chrome) for selected unlocked nodes; drag live-previews via `previewNodeBounds` / `GraphScene.writeBounds`; pointer-up `commitNodeResize` applies `updateNode` `{ x, y, w, h }` and emits `nodeResized`. Minimum size 24×24. Capture-phase pointerdown + pack before `MoveNodeInteraction` so handles win over move. Demo editor packs `ResizeNodeInteraction` before `MoveNodeInteraction`.

Deferred: rotate handles, `MoveLinkInteraction` / edge bend points.

## Alternatives considered

- **Shift alone toggles append:** rejected — Shift already distinguishes marquee from pan.
- **Always-union marquee:** rejected — replace-only remains the default.
- **Ship rotate with resize:** rejected — no rotation field on `GraphNode`.
- **Ship MoveLink first:** rejected — edges are auto-routed; bend points need protocol fields first.

## Consequences

- Hosts that relied on replace-only marquee are unchanged unless they hold Ctrl/Meta at pointer-up.
- Out-of-tree `Renderer` implementers must provide `drawResizeHandle`.
- Resize live preview dirties incident edges each frame (same class as live move).

## Testing

- `tests/marquee.spec.ts` — marquee selection (see also [twaver selection parity](../feature/2026-11-05-twaver-selection-parity.md)).
- `tests/resize-node.spec.ts` — handles for unlocked selection; SE resize commit; locked ignored.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

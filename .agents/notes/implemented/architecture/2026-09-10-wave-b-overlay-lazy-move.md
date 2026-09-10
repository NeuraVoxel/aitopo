# Agent Note: Wave B overlay chrome, lazy move, drop-target highlight

Status: implemented

## Problem

Network special-cased marquee and edge rubber-band through private fields and dedicated setters, so every new overlay gesture grew `Network.validate`. Live move always mutated node positions via `previewNodePosition`, with no ghost outline mode for large graphs. During move, the drop-target group was only resolved on pointer-up, with no temporary highlight.

## Decision

Wave B ships three interaction/paint changes on top of Wave A Views / injectable `Renderer`:

1. **Overlay chrome registry** — `InteractionHost.addOverlayChrome(chrome) → disposer` and `requestPaint()`. `OverlayChrome.paint(renderer)` runs after scene + selection paint. `MarqueeSelectInteraction` and `CreateEdgeInteraction` register chrome for the gesture duration. `setMarqueeRect` / `setEdgeRubberBand` and Network private marquee/rubber fields are removed. Selection rings for selected nodes stay Network-owned.
2. **Lazy move (optional)** — `MoveNodeInteractionOptions.lazyMove` (default `false`). When true: no `previewNodePosition` during drag; ghost node bounds via `Renderer.drawLazyMoveGhost`; commit still uses `commitNodeMove`. When `lazyMove` is true, `hideOthersWhileDragging` does not apply a paint filter.
3. **Drop-target group highlight** — While a move gesture is active, hit-test groups under the pointer and paint via `Renderer.drawDropTargetHighlight`. Membership commit semantics are unchanged.

Execution checklist: [Wave B plan](../../../docs/2026-09-10-aitopo-wave-b-overlay-lazy-move.md).

### Deferred (not Wave B)

Resize/rotate handles, Attachment tree, pixel hit-test, Marquee Shift-append, Logical/Mixed zoom, Overview, HTML UI.

## Alternatives considered

- **Keep setMarqueeRect / setEdgeRubberBand forever:** rejected — every overlay gesture would keep adding Network fields and validate branches.
- **Always lazy move:** rejected — live move remains the editor default; lazy is opt-in.
- **Highlight only via changing group.style in the document:** rejected — must not mutate durable document for transient chrome.
- **twaver marker + P-key reparent chord:** rejected — clean-room names; AITopo reparents from pointer hit without a chord key.

## Consequences

- New overlay gestures register chrome instead of extending Network private state.
- Out-of-tree `Renderer` implementers must provide `drawLazyMoveGhost` and `drawDropTargetHighlight`.
- Combining `lazyMove` with `hideOthersWhileDragging` leaves the full scene visible (filter suppressed).

## Testing

- `tests/marquee.spec.ts` / `tests/create-edge.spec.ts` — chrome registry instead of setters.
- `tests/move-node.spec.ts` — lazyMove skips preview and paints ghosts; drop-target highlight while over a group.
- `tests/overlay-chrome.spec.ts` — `addOverlayChrome` disposer contract.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

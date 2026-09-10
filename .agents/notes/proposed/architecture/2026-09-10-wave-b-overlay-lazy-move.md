# Agent Note: Wave B overlay chrome, lazy move, drop-target highlight

Status: proposed

## Problem

Network still special-cases marquee and edge rubber-band through private fields and dedicated setters, so every new overlay gesture grows `Network.validate`. Live move always mutates node positions via `previewNodePosition`, which is costly on large graphs and offers no ghost outline mode. During move, the drop-target group is only resolved on pointer-up, with no temporary highlight (twaver `parentRect` idea), so membership edits are hard to aim.

## Proposal

Ship Wave B as three interaction/paint changes on top of Wave A Views / injectable `Renderer`:

1. **Overlay chrome registry** — `InteractionHost.addOverlayChrome(chrome) → disposer` where `OverlayChrome.paint(renderer)` draws on the overlay after scene paint. Migrate `MarqueeSelectInteraction` and `CreateEdgeInteraction` to register chrome for the gesture duration. Remove `Network` private `marqueeRect` / `edgeRubberBand` fields and the `setMarqueeRect` / `setEdgeRubberBand` host methods (or keep thin deprecated wrappers only if a test still needs them — prefer delete). Selection rings for selected nodes stay Network-owned (not interaction chrome).
2. **Lazy move (optional)** — `MoveNodeInteractionOptions.lazyMove` (default `false`). When true: do not call `previewNodePosition` during drag; paint ghost node bounds on the overlay at `from + delta`; commit still uses `commitNodeMove` on pointer-up; abort only clears chrome. Live move remains the default.
3. **Drop-target group highlight** — While a move gesture is active (live or lazy), hit-test groups under the pointer each move and paint a temporary highlight on that group’s bounds via overlay chrome (clear when none / on gesture end). Membership commit semantics stay as today.

Widen `Renderer` with `drawDropTargetHighlight(bounds)` and `drawLazyMoveGhost(bounds)` (Canvas2D implementations). Execution checklist: [Wave B plan](../../../docs/2026-09-10-aitopo-wave-b-overlay-lazy-move.md).

### Deferred (not Wave B)

Resize/rotate handles, Attachment tree, pixel hit-test, Marquee Shift-append, Logical/Mixed zoom, Overview, HTML UI, marker paint that bypasses `Renderer` (no raw canvas ctx on interactions).

## Alternatives considered

- **Keep setMarqueeRect / setEdgeRubberBand forever:** rejected — every overlay gesture would keep adding Network fields and validate branches.
- **Always lazy move:** rejected — live move is the current editor default and matches Wave A behavior; lazy is opt-in for large graphs.
- **Highlight only via changing group.style in the document:** rejected — must not mutate durable document for transient chrome.
- **twaver marker + P-key reparent chord:** rejected — clean-room names; AITopo already reparents from pointer hit without a chord key.

## Acceptance criteria

- Marquee and create-edge overlay chrome go through `addOverlayChrome`; Network validate has no marquee/rubber-band private fields.
- `new MoveNodeInteraction({ lazyMove: true })` does not call `previewNodePosition` during drag; ghosts appear on overlay; commit still emits `nodeMoved`.
- During move, a group under the pointer shows drop-target highlight; clear on gesture end.
- `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes` pass; gap backlog rows for lazy move and drop-target highlight marked `done`.

## Risks

- Migrating marquee/create-edge can break gesture cleanup if disposers miss pointercancel — cover with existing interaction tests plus overlay registry unit tests.
- Lazy move + hideOthersWhileDragging together may look empty (no live nodes, only ghosts) — document that hosts should not combine them, or force full-scene paint when lazy.
- Extra Renderer methods break out-of-tree implementers; same trade as Wave A overlay widening.

# Agent Note: Wave C marquee append and node resize

Status: proposed

## Problem

Marquee selection always replaces the current selection, so hosts cannot add a rect-select set to an existing multi-select without clearing first. Nodes expose `w` / `h` in the protocol but there is no interaction to resize them; hosts cannot offer edit chrome for size without forking Network. Rotate and edge bend-point editing remain larger protocol questions (no edge control points today).

## Proposal

Ship Wave C as two editor interaction upgrades on Wave A/B chrome and Views:

1. **Marquee append** — While Shift+empty marquee is active, if **Ctrl** or **Meta** is held at pointer-up, union intersecting node ids with the current selection (dedupe); otherwise keep replace-only behavior. Document that Shift still means “marquee vs pan”; Ctrl/Meta means “append vs replace”.
2. **Node resize** — New `ResizeNodeInteraction`: when the selection includes unlocked nodes, paint four corner handles via overlay chrome; drag a handle to live-preview bounds (`previewNodeBounds`); pointer-up `commitNodeResize` applies `updateNode` `{ x, y, w, h }` and emits `nodeResized`. Skip locked nodes. Minimum size 24×24 world units. Pack **before** `MoveNodeInteraction` so handle hits win over move. Live preview only (no lazy resize in this wave).

Defer: rotate handles, `MoveLinkInteraction` / edge control points (needs protocol bend points), Attachment tree.

Execution checklist: [Wave C plan](../../../docs/2026-09-10-aitopo-wave-c-marquee-resize.md).

## Alternatives considered

- **Shift alone toggles append:** rejected — Shift already distinguishes marquee from pan; overloading it would break the empty-drag pan contract.
- **Always-union marquee:** rejected — replace-only is the current Editor F1 behavior hosts may rely on.
- **Ship rotate with resize:** rejected — no rotation field on `GraphNode`; would invent protocol without product demand.
- **Ship MoveLink first:** rejected — edges are auto-routed; bend points need a protocol field and View route cache changes first.

## Acceptance criteria

- Shift+marquee without Ctrl/Meta still replace-selects; with Ctrl or Meta at pointer-up, selection is the union of previous selection and intersecting ids.
- `ResizeNodeInteraction` resizes an unlocked selected node via corner handle; locked nodes show no handles / ignore resize; `nodeResized` fires on commit; `documentChanged` still fires via `apply`.
- `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes` pass; gap backlog marks marquee append and resize handles `done` (rotate / MoveLink stay `later`).

## Risks

- Handle hit-testing vs move race if packing order is wrong — document pack-before-MoveNode and test handle-down does not call `commitNodeMove`.
- Live resize during drag dirties incident edges each frame — acceptable; same cost class as live move.
- Append with locked nodes still selects them (consistent with replace marquee).

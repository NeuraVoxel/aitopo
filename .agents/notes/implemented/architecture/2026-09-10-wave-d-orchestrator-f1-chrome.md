# Agent Note: Wave D orchestrator F1 edit chrome

Status: implemented

## Problem

AITopo Editor APIs (AT-E1–E6, AT-E8) shipped in the engine, but `dsh-agent-orchestrator` mounted a read-only `Network` and kept `unit.locked` only under `GraphNode.data`. Operators could not move unlocked units, marquee-select, or undo canvas edits through public AITopo interactions.

## Decision

Wave D ships **orchestrator F1 canvas edit chrome** (gap P0). Code lives in `plugins/agent-orchestrator`; this package records the decision and gap status.

1. **`GraphNode.locked`** — `toGraphDocument` sets first-class `locked: true` when `unit.locked` (still mirrors under `data.locked`).
2. **Editor interactions on `AITopoHost`** — `editable` packs `ResizeNodeInteraction` → `MoveNodeInteraction` → `MarqueeSelectInteraction` and routes `apply` through `PatchHistory`. Orchestrator mounts with `editable`.
3. **Session layout** — `nodeMoved` updates per-preset positions via `applyNodeMovedToLayout` / `withSessionLayout` (`session-layout.ts`). Layer `groupMembershipChanged` does not change catalog↔composition membership. Undo/redo sync positions from `captureNodePositions`.
4. **Copy** — hint states layout is session-local until CommitSink.
5. **Gap** — `agent-observe` adapter marked `done`; F1 chrome done; CommitSink / rotate / MoveLink remain later.

Execution checklist: [Wave D plan](../../../docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md).

## Alternatives considered

- **Wave D = rotate + MoveLink in the engine:** rejected for this wave — gap P0 is product hosts; both need new protocol fields.
- **Full F1 including CommitSink / preset write-back in the same wave:** deferred — larger Host Remote and snapshot surface.
- **Reimplement drag/marquee in React overlays:** rejected — orchestrator design forbids substituting for AITopo interactions.
- **Treat architectural layer reparent as composition membership:** rejected — composition vs catalog is document membership, not `GraphGroup.memberIds`.

## Consequences

- System-preset units refuse move/resize via `GraphNode.locked`.
- Layout edits survive preset/catalog toggle within the tab mount; they are not written to Preset until CommitSink.
- Live activity reloads of `GraphDocument` still reset `PatchHistory` (same class as any full `load`).

## Testing

- `plugins/agent-orchestrator` — `adapters.spec.ts` locked projection; `session-layout.spec.ts` merge helpers.
- `pnpm --filter dsh-agent-orchestrator test` and `typecheck`.
- aitopo: `pnpm run verify-notes`.

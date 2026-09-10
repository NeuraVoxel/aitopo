# Agent Note: Wave D orchestrator F1 edit chrome

Status: proposed

## Problem

AITopo Editor APIs (AT-E1–E6, AT-E8) ship in the engine, but `dsh-agent-orchestrator` still mounts a read-only `Network` and keeps `unit.locked` only under `GraphNode.data`. Operators cannot move unlocked units, marquee-select, or undo canvas edits through public AITopo interactions. `agent-observe` already renders via AITopo; the gap backlog still lists both hosts as open. Rotate and MoveLink remain protocol-sized and are not required for F1 chrome.

## Proposal

Ship Wave D as **orchestrator F1 canvas edit chrome** (gap P0), with code in `plugins/agent-orchestrator` and gap/docs updates in this package:

1. **`GraphNode.locked`** — `toGraphDocument` sets first-class `locked: unit.locked` (keep `data.locked` only if hosts still read it; prefer first-class).
2. **Editor interactions on `AITopoHost`** — when edit mode is on, construct `Network` with `MoveNodeInteraction`, `MarqueeSelectInteraction`, and `ResizeNodeInteraction` (resize before move). Defaults (`PanZoom`, `SelectActivate`) stay. No DOM/SVG gesture reimplementation.
3. **Apply into `OrchestrationDocument`** — on `nodeMoved`, update `layout.positions` for moved ids; ignore layer `groupMembershipChanged` for catalog↔composition (layers stay architectural bands). Selection continues to drive the detail panel.
4. **`PatchHistory`** — wire optional undo/redo in the orchestrator toolbar around Network `apply` (same pattern as the aitopo demo Editor mode), or an equivalent host-owned layout stack if reload semantics make Network history unreliable.
5. **Gap backlog** — mark `agent-observe` adapter `done`; mark orchestrator F1 chrome done when the above ships; leave CommitSink / preset draft write-back as a follow-up wave; leave rotate / MoveLink `later`.

Execution checklist: [Wave D plan](../../../docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md).

## Alternatives considered

- **Wave D = rotate + MoveLink in the engine:** rejected for this wave — gap P0 is product hosts; both need new protocol fields and are not required for orchestrator F1.
- **Full F1 including CommitSink / preset write-back in the same wave:** deferred — larger Host Remote and snapshot surface; chrome apply unblocks editing without inventing commit UX mid-wave.
- **Reimplement drag/marquee in React overlays:** rejected — orchestrator design forbids substituting for AITopo interactions.
- **Treat architectural layer reparent as composition membership:** rejected — composition vs catalog is document membership, not `GraphGroup.memberIds`.

## Acceptance criteria

- System-preset units project `GraphNode.locked === true` and refuse move/resize.
- Orchestrator Client packs editor interactions; hint copy no longer says editing waits on AITopo Editor.
- `nodeMoved` persists into `OrchestrationDocument.layout`; reload/preset switch keeps positions.
- Undo/redo restores the last canvas edit path chosen in the proposal (Network `PatchHistory` or host layout stack).
- Gap backlog rows for observe + F1 chrome match shipped reality; `pnpm test` / typecheck in aitopo and focused orchestrator tests pass.

## Risks

- Reloading `GraphDocument` on every layout write may flicker or clear selection — mitigate by preserving selection after load or avoiding redundant `load` when only positions changed.
- Layer drop-target during move can briefly rewrite `groupId` before the next projection — acceptable if projection from `unit.layer` wins on reload.
- Shipping chrome without CommitSink may look like “edit without save” — surface copy must say layout is session-local until commit lands.

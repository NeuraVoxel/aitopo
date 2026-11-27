# Agent Note: OCC select-all commit blocks pointer release

Status: implemented

## Problem

After the preview-path fix in [OCC select-all drag hang](2026-11-27-occ-select-all-drag-hang.md), OCC Demo still froze on pointer-up when select-all (~4k cells) finished a drag: the page kept pointer capture / lazy chrome as if the move never ended. Edit mode was worse — `PatchHistory.pushAndApply` called `invertPatch`, which ran `applyPatch` once per op (each with `structuredClone`), so invert alone was O(N×clone) and never returned.

## Decision

1. **`applyPatch` updateNode batch** — when every expanded op is `updateNode`, merge patches by id and rewrite the nodes array in one O(nodes + ops) pass (no per-op `findIndex`/`slice`, no full `structuredClone`).
2. **`invertPatch` independent updateNode batch** — when every op is `updateNode` on a distinct id, invert against a pre-apply node id map in reverse order; fall back to the sequential apply path when ids repeat or other op kinds appear.
3. **`MoveNodeInteraction` pointer-up `try`/`finally`** — always `clearPaintFilter` / clear lazy chrome / `releasePointerCapture` / `reset` after a drag, even when commit throws.

## Alternatives considered

- **Skip history for bulk commits:** would unblock observe-mode hosts only; Edit mode still needs undo of select-all moves.
- **`writePositions` commit bypassing GraphPatch:** faster, but drops zod validation and history invert; batch apply/invert keeps the same contract.
- **Only `try`/`finally` without fast apply/invert:** release would run, but the main thread would still freeze for seconds/minutes before the UI responds.

## Consequences

- Bulk select-all drag commit (with or without `PatchHistory`) stays interactive; pointer capture drops even if commit errors.
- Tests: `tests/perf-select-all-drag.spec.ts` (history-wrapped commit budget on Elements Perf), `tests/patch.spec.ts` / `tests/patch-history.spec.ts` (batch apply/invert budgets), `tests/move-node.spec.ts` (release on commit throw).
- Mixed patches and repeated-id `updateNode` sequences still use the slow invert path.

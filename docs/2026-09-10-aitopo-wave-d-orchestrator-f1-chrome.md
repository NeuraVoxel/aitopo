# AITopo Wave D — Orchestrator F1 edit chrome

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md](../.agents/notes/implemented/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md). Execution checklist only.

> **For agentic workers:** Wave D has shipped (orchestrator plugin + this note). Historical task steps remain below for audit.

**Goal:** Map `locked`, attach Move/Marquee/Resize + PatchHistory, persist `nodeMoved` into session layout.

**Depends on:** Editor milestone + Waves A–C.

**Out of scope:** CommitSink / preset write-back, rotate, MoveLink, agent-observe changes (already on AITopo).

---

## File map

| Path | Role |
|---|---|
| `plugins/agent-orchestrator/src/to-graph.ts` | `GraphNode.locked` from `unit.locked` |
| `plugins/agent-orchestrator/src/client/aitopo/AITopoHost.tsx` | Optional editor interactions + PatchHistory |
| `plugins/agent-orchestrator/src/client/OrchestratorView.tsx` | Apply `nodeMoved` → layout; undo UI; hint copy |
| `plugins/agent-orchestrator/src/session-layout.ts` | Session layout merge helpers |
| `plugins/agent-orchestrator/src/client/locales.ts` | Editable / session-local layout hints |
| `plugins/agent-orchestrator/src/adapters.spec.ts` / `session-layout.spec.ts` | locked + layout helpers |
| `docs/2026-09-09-aitopo-twaver-vector-gap.md` | observe `done`; F1 chrome done |
| Agent Note | Promoted on ship |

---

### Task 1: locked projection

- [x] Set `locked: unit.locked` on projected `GraphNode`.
- [x] Test system preset → locked true; user → false/undefined.
- [x] Commit (harness): `fix(agent-orchestrator): project unit.locked onto GraphNode.locked`

### Task 2: AITopoHost editor pack

- [x] `editable?: boolean` packs Resize → Move → Marquee.
- [x] Optional `PatchHistory` + undo/redo handle methods.
- [x] Commit (harness): `feat(agent-orchestrator): pack AITopo editor interactions on host`

### Task 3: OrchestratorView apply path

- [x] `nodeMoved` updates session layout positions.
- [x] Preserve positions across catalog toggle via `withSessionLayout`; update hint copy.
- [x] Undo/redo wired; tests for layout helpers.
- [x] Commit (harness): `feat(agent-orchestrator): persist nodeMoved into orchestration layout`

### Task 4: Docs + promote note

- [x] Gap backlog + README links; promote Agent Note; `pnpm run verify-notes` in aitopo.
- [x] Commit (aitopo): `docs: promote Wave D Agent Note and update gap backlog`

---

## Verify

```sh
# aitopo
pnpm test && pnpm run typecheck && pnpm run verify-notes

# harness (focused)
pnpm --filter dsh-agent-orchestrator test
pnpm --filter dsh-agent-orchestrator typecheck
```

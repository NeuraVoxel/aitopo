# AITopo Wave D — Orchestrator F1 edit chrome

> **Owning decision:** [.agents/notes/proposed/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md](../.agents/notes/proposed/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md). Execution checklist only.

> **For agentic workers:** Implement task-by-task. Engine APIs already ship; work is primarily `plugins/agent-orchestrator` plus gap/docs in this package.

**Goal:** Map `locked`, attach Move/Marquee/Resize + optional PatchHistory, persist `nodeMoved` into `OrchestrationDocument.layout`.

**Depends on:** Editor milestone + Waves A–C.

**Out of scope:** CommitSink / preset write-back, rotate, MoveLink, agent-observe changes (already on AITopo).

---

## File map

| Path | Role |
|---|---|
| `plugins/agent-orchestrator/src/to-graph.ts` | `GraphNode.locked` from `unit.locked` |
| `plugins/agent-orchestrator/src/client/aitopo/AITopoHost.tsx` | Optional editor interactions + PatchHistory |
| `plugins/agent-orchestrator/src/client/OrchestratorView.tsx` | Apply `nodeMoved` → layout; undo UI; hint copy |
| `plugins/agent-orchestrator/src/client/locales.ts` | Editable / session-local layout hints |
| `plugins/agent-orchestrator/src/adapters.spec.ts` (or new) | locked projection + layout apply helpers |
| `docs/2026-09-09-aitopo-twaver-vector-gap.md` | observe `done`; F1 chrome progress |
| Agent Note | Promote on ship |

---

### Task 1: locked projection

- [ ] Set `locked: unit.locked` on projected `GraphNode`.
- [ ] Test system preset → locked true; user → false/undefined.
- [ ] Commit (harness): `fix(agent-orchestrator): project unit.locked onto GraphNode.locked`

### Task 2: AITopoHost editor pack

- [ ] `editable?: boolean` (or always-on for orchestrator) packs Resize → Move → Marquee.
- [ ] Optional `PatchHistory` + undo/redo handle methods.
- [ ] Commit (harness): `feat(agent-orchestrator): pack AITopo editor interactions on host`

### Task 3: OrchestratorView apply path

- [ ] `nodeMoved` updates `OrchestrationDocument.layout.positions`.
- [ ] Preserve selection across reload when needed; update hint copy.
- [ ] Undo/redo wired; tests for layout helper if extracted.
- [ ] Commit (harness): `feat(agent-orchestrator): persist nodeMoved into orchestration layout`

### Task 4: Docs + promote note

- [ ] Gap backlog + README links; promote Agent Note; `pnpm run verify-notes` in aitopo.
- [ ] Commit (aitopo): `docs: promote Wave D Agent Note and update gap backlog`

---

## Verify

```sh
# aitopo
pnpm test && pnpm run typecheck && pnpm run verify-notes

# harness (focused)
pnpm --filter dsh-agent-orchestrator test
pnpm --filter dsh-agent-orchestrator typecheck
```

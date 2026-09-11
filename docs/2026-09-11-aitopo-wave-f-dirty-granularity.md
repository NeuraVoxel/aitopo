# AITopo Wave F — Apply / preview dirty granularity

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-11-wave-f-dirty-granularity.md](../.agents/notes/implemented/architecture/2026-09-11-wave-f-dirty-granularity.md). This file is the **execution checklist** only.

> **For agentic workers:** Wave F ships with this change. Clean-room: no SDK2D imports, no twaver public names. Do not change Document / Patch / Events schemas.

**Goal:** Diff-based scene dirty ids on `apply`; old∪new dirty-rects for sync and live preview; stop preview `markAll`.

**Depends on:** Wave E paint channels.

**Out of scope:** View facets (G), InteractionHost split (H), rotate / move-link.

---

## File map

| Path | Role |
|---|---|
| `src/model/scene.ts` | Op→id dirty collection; `commitActive` no longer dirties all on partial |
| `src/network/network.ts` | Old∪new in `syncDirtyFromScene`; preview without `markAll` |
| `tests/scene-graph.spec.ts` | Dirty id assertions |
| `tests/paint-channels.spec.ts` | Preview partial dirty |
| Gap backlog / README | Mark Wave F done |

---

### Task 1: Scene op→id dirty

- [x] Collect dirty ids from ops (pre-apply doc); `setViewport` → invalidateAll
- [x] `commitActive(false)` only adds collected ids

### Task 2: Network old∪new + preview

- [x] Capture View bounds before `views.sync` in `syncDirtyFromScene`
- [x] `previewNodePosition` / `previewNodeBounds` use old∪new, not `markAll`

### Task 3: Tests + docs

- [x] Scene + paint-channel coverage
- [x] Promote Agent Note; gap backlog; README

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

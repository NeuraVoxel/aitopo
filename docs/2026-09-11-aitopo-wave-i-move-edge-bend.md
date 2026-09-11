# AITopo Wave I — Move-edge bend waypoints

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-11-wave-i-move-edge-bend.md](../.agents/notes/implemented/architecture/2026-09-11-wave-i-move-edge-bend.md). This file is the **execution checklist** only.

> **For agentic workers:** Wave I ships with this change. Clean-room: no SDK2D imports, no twaver public names (`MoveEdgeBendInteraction`, not `MoveLinkInteraction`).

**Goal:** Persist and edit orthogonal edge bend waypoints with selected-edge handles.

**Depends on:** Waves E–H (overlay chrome, dirty preview, GestureEditor).

**Out of scope:** Freeform polylines; ShapeLink; rotate; CommitSink; multi-edge bundles.

---

## File map

| Path | Role |
|---|---|
| `src/protocol/types.ts` / `schema.ts` / `events.ts` / `patch.ts` / `invert.ts` | `waypoints` + `edgeWaypointsChanged` |
| `src/ui/bounds.ts` / `edge-view.ts` | `edgeAnchors(..., waypoints?)` |
| `src/model/scene.ts` | `writeEdgeWaypoints` |
| `src/network/gesture-editor.ts` / `network.ts` | preview / commit |
| `src/interaction/move-edge-bend.ts` | bend handles + axis drag |
| `src/render/canvas2d.ts` | `drawEdgeBendHandle` |
| `demo/main.ts` | pack before MoveNode |

---

### Tasks

- [x] Protocol field + merge/invert + event
- [x] Routing + EdgeView + preview dirty
- [x] GestureEditor + MoveEdgeBendInteraction + renderer
- [x] Demo + Agent Note + gap backlog + tests

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

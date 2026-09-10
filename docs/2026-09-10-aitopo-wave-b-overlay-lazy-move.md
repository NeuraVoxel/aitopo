# AITopo Wave B — Overlay chrome, lazy move, drop-target highlight

> **Owning proposal:** [.agents/notes/proposed/architecture/2026-09-10-wave-b-overlay-lazy-move.md](../.agents/notes/proposed/architecture/2026-09-10-wave-b-overlay-lazy-move.md). This file is the **execution checklist** only.

> **For agentic workers:** Implement task-by-task. When shipping, promote the Agent Note `proposed/` → `implemented/`. Clean-room: no SDK2D imports, no twaver public names.

**Goal:** Replace Network-hardcoded marquee/rubber-band fields with an overlay chrome registry; add optional lazy-move ghosts; highlight the drop-target group during move.

**Depends on:** Wave A ([decision](../.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md)).

**Out of scope:** Resize/rotate, Shift-append marquee, Attachment tree, pixel hit-test.

---

## File map

| Path | Role |
|---|---|
| `src/interaction/types.ts` | Add `OverlayChrome`; `addOverlayChrome`; remove `setMarqueeRect` / `setEdgeRubberBand` |
| `src/network/network.ts` | Chrome set + paint in `validate`; drop marquee/rubber fields |
| `src/render/canvas2d.ts` | `drawDropTargetHighlight`, `drawLazyMoveGhost` on `Renderer` |
| `src/interaction/marquee-select.ts` | Register chrome during gesture |
| `src/interaction/create-edge.ts` | Register chrome during gesture |
| `src/interaction/move-node.ts` | `lazyMove` option; drop-target highlight chrome |
| `tests/overlay-chrome.spec.ts` | **Create** — registry add/remove / paint order |
| `tests/move-node.spec.ts` | Lazy move + highlight behavior |
| `docs/2026-09-09-aitopo-twaver-vector-gap.md` | Mark lazy move + drop-target `done` |
| Agent Note | Promote on ship |

---

### Task 1: Overlay chrome registry + migrate marquee / create-edge

**Files:** `types.ts`, `network.ts`, `marquee-select.ts`, `create-edge.ts`, `tests/overlay-chrome.spec.ts`, update fakes in interaction tests

- [ ] **Step 1:** Add

```ts
export interface OverlayChrome {
  paint(renderer: Renderer): void
}
// InteractionHost:
addOverlayChrome(chrome: OverlayChrome): () => void
```

- [ ] **Step 2:** Network keeps `Set`/`Array` of chrome; after scene+selection paint, call each `paint(renderer)` then existing marquee/rubber paths removed.

- [ ] **Step 3:** Marquee / CreateEdge: on gesture start `const remove = network.addOverlayChrome({ paint(r) { ... } })` updating closed-over rect/band; on end `remove()`.

- [ ] **Step 4:** Delete `setMarqueeRect` / `setEdgeRubberBand` from host + Network; fix all tests/fakes.

- [ ] **Step 5:** `pnpm test` + typecheck; commit

```text
feat(interaction): overlay chrome registry for marquee and rubber-band
```

---

### Task 2: Renderer ghost + drop-target draw helpers

**Files:** `src/render/canvas2d.ts`, `tests/network-renderer.spec.ts` (fake)

- [ ] Add `drawLazyMoveGhost(bounds: Rect)` and `drawDropTargetHighlight(bounds: Rect)` to `Renderer` + Canvas2D (dashed outline / filled band).

- [ ] Update fake renderers in tests; commit

```text
feat(render): draw lazy-move ghost and drop-target highlight
```

---

### Task 3: MoveNodeInteraction lazy move + drop-target highlight

**Files:** `move-node.ts`, `tests/move-node.spec.ts`

- [ ] `lazyMove?: boolean` (default false). Lazy path: no `previewNodePosition`; overlay ghosts at from+delta.
- [ ] Both modes: each move update `dropTargetGroupId` via `hitTestGroupScreen`; paint highlight with `drawDropTargetHighlight` using `getGroups()` bounds (`groupBounds`).
- [ ] If `lazyMove && hideOthersWhileDragging`, ignore hide filter (always full scene) or document — **prefer:** when `lazyMove`, do not apply `setDragPaintFilter`.
- [ ] Tests: spy that lazy mode never calls `previewNodePosition`; highlight chrome present while over group.
- [ ] Commit

```text
feat(interaction): lazy move ghosts and drop-target group highlight
```

---

### Task 4: Docs + promote Agent Note

- [ ] Gap backlog: lazy move + drop-target → `done`; P1/P2 checkboxes.
- [ ] README Known Limitations / Wave B links if needed.
- [ ] Promote Agent Note; `pnpm run verify-notes`.
- [ ] Commit

```text
docs: promote Wave B Agent Note and update gap backlog
```

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

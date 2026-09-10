# AITopo Wave C — Marquee append and node resize

> **Owning proposal:** [.agents/notes/proposed/architecture/2026-09-10-wave-c-marquee-resize.md](../.agents/notes/proposed/architecture/2026-09-10-wave-c-marquee-resize.md). Execution checklist only.

**Goal:** Ctrl/Meta+Shift marquee appends to selection; `ResizeNodeInteraction` resizes unlocked nodes via corner handles.

**Depends on:** Wave A Views, Wave B overlay chrome.

**Out of scope:** Rotate, MoveLink / edge bends, Attachment tree.

---

## File map

| Path | Role |
|---|---|
| `src/interaction/marquee-select.ts` | Append when ctrl/meta at pointer-up |
| `src/interaction/resize-node.ts` | **Create** — handles + drag resize |
| `src/interaction/types.ts` | `previewNodeBounds`, `commitNodeResize` |
| `src/interaction/index.ts` | Export `ResizeNodeInteraction` |
| `src/network/network.ts` | Implement preview/commit resize |
| `src/protocol/events.ts` | `nodeResized` |
| `src/render/canvas2d.ts` | `drawResizeHandle` |
| `src/model/scene.ts` | Optional `writeBounds` for live preview |
| `tests/marquee.spec.ts` | Append case |
| `tests/resize-node.spec.ts` | **Create** |
| gap backlog / Agent Note | Promote on ship |

---

### Task 1: Marquee append

- [ ] At pointer-up, if `event.ctrlKey || event.metaKey`, `setSelection([...new Set([...getSelectedIds(), ...ids])])`; else replace.
- [ ] Test append and replace paths.
- [ ] Commit: `feat(interaction): Ctrl/Meta marquee appends to selection`

### Task 2: Resize interaction + protocol event

- [ ] Add `NodeResizedEvent`; Network `previewNodeBounds` / `commitNodeResize`.
- [ ] `ResizeNodeInteraction` + `drawResizeHandle`; min 24×24; skip locked.
- [ ] Tests; commit: `feat(interaction): resize unlocked nodes via corner handles`

### Task 3: Docs + promote note

- [ ] Gap backlog + README links; promote Agent Note; verify-notes.

---

## Verify

```sh
pnpm test && pnpm run typecheck && pnpm run verify-notes
```

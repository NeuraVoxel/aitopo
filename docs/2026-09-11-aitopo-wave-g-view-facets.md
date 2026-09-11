# AITopo Wave G — View label / alarm / hit facets

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-11-wave-g-view-facets.md](../.agents/notes/implemented/architecture/2026-09-11-wave-g-view-facets.md). This file is the **execution checklist** only.

> **For agentic workers:** Wave G ships with this change. Clean-room: no SDK2D imports, no twaver public names.

**Goal:** Cache label/alarm paint facets on NodeView; hit-test through validated View geometry.

**Depends on:** Wave A Views, Wave F dirty ids.

**Out of scope:** Wave H InteractionHost split; Attachment tree; measureText; rotate / move-link.

---

## File map

| Path | Role |
|---|---|
| `src/render/canvas2d.ts` | Extend `NodePaintView`; `drawNode` uses facets |
| `src/ui/node-view.ts` | Cache label / meta / circular / alarm |
| `src/ui/edge-view.ts` | Expose `points` |
| `src/network/network.ts` | Hit-test via Views |
| `tests/view-set.spec.ts` / `tests/hit-views.spec.ts` | Facet + hit coverage |

---

### Tasks

- [x] NodePaintView + NodeView facets + renderer
- [x] EdgeView.points + Network hit via Views
- [x] Tests + docs + gap backlog

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

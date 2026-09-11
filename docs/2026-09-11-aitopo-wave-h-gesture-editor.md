# AITopo Wave H — GestureEditor + OverlayChromeRegistry

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-11-wave-h-gesture-editor.md](../.agents/notes/implemented/architecture/2026-09-11-wave-h-gesture-editor.md). This file is the **execution checklist** only.

> **For agentic workers:** Wave H ships with this change. Clean-room: no SDK2D imports, no twaver public names. Keep `InteractionHost` method compatibility.

**Goal:** Extract chrome registry and gesture/edit mutations from Network; Network composes and delegates.

**Depends on:** Waves E–G.

**Out of scope:** Public GestureEditor export unless needed; rotate / move-link; HitController extraction.

---

## File map

| Path | Role |
|---|---|
| `src/network/overlay-chrome-registry.ts` | Chrome list + paintAll |
| `src/network/gesture-editor.ts` | Filter, gesture flag, preview, commits |
| `src/network/network.ts` | Compose + delegate |
| `src/interaction/types.ts` | Facet intersection docs |
| `tests/gesture-editor.spec.ts` | Editor unit tests |
| `tests/overlay-chrome-registry.spec.ts` | Registry unit tests |

---

### Tasks

- [x] OverlayChromeRegistry
- [x] GestureEditor + Network wire-up
- [x] Facet types + tests + docs

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

# AITopo Wave E — Scene vs overlay paint channels

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-11-wave-e-paint-channels.md](../.agents/notes/implemented/architecture/2026-09-11-wave-e-paint-channels.md). This file is the **execution checklist** only.

> **For agentic workers:** Wave E has shipped on `refactor`. Historical task steps remain below for audit. Clean-room: no SDK2D imports, no twaver public names. Do not change Document / Patch / Events schemas.

**Goal:** Schedule overlay chrome, selection, and hover without rebaking the root canvas; keep scene dirty-rect / `'all'` for real content and camera changes.

**Depends on:** Wave A (Views / Renderer), Wave B (OverlayChrome registry).

**Out of scope:** Apply op→id dirty (Wave F), preview dirty-rect narrowing (Wave F), View facets (Wave G), InteractionHost split (Wave H), rotate / move-link.

---

## Minimal API draft (ship in this wave)

### `InteractionHost` (`src/interaction/types.ts`)

```ts
/**
 * Schedule overlay clear + selection/hover/chrome paint.
 * Does not clear or redraw the root canvas.
 */
requestOverlayPaint(): void

/**
 * Alias of `requestOverlayPaint` (chrome-era call sites).
 * Prefer `requestOverlayPaint` in new code.
 */
requestPaint(): void
```

### `Renderer.beginFrame` (`src/render/canvas2d.ts`)

```ts
beginFrame(
  viewport: ViewportState,
  dirty: readonly Rect[] | 'all' | 'overlay',
): void
```

| `dirty` | Root | Overlay |
|---|---|---|
| `'all'` | full clear + paint | full clear + transform |
| `Rect[]` | clear/clip union + paint | full clear + transform |
| `'overlay'` | untouched | full clear + transform |

### Network internal flags

```ts
private needsScenePaint = true
private needsOverlayPaint = true
// needsPaint may be removed or become (needsScenePaint || needsOverlayPaint)
```

### Select / hover paint rule

- Root `drawNode` stroke **ignores** `view.selected` / `view.hovered`.
- Overlay pass draws selection rings + hover ring + highlighted edges.

---

## File map

| Path | Role |
|---|---|
| `src/interaction/types.ts` | Add `requestOverlayPaint`; document `requestPaint` alias |
| `src/network/network.ts` | Dual flags; `validate` scene vs overlay; migrate selection/hover/chrome |
| `src/network/dirty.ts` | No API change required (still scene-only accumulator) |
| `src/render/canvas2d.ts` | `beginFrame` accepts `'overlay'`; root stroke ignores select/hover |
| `src/interaction/*.ts` | Chrome updates → `requestOverlayPaint` |
| `tests/paint-channels.spec.ts` | **Create** — overlay-only vs scene `'all'` |
| `tests/*` fakes | Accept `'overlay'` on `beginFrame` |
| `docs/2026-09-09-aitopo-twaver-vector-gap.md` | Engine-debt row for paint channels |
| README | Link Wave E; note select visual if needed |
| Agent Note | Promote `proposed` → `implemented` on ship |

---

### Task 1: Renderer `'overlay'` mode + root stroke decoupling

**Files:** `src/render/canvas2d.ts`, renderer fakes in tests

- [x] **Step 1:** Widen `beginFrame` dirty union with `'overlay'`; skip root clear/clip/save when `'overlay'`.
- [x] **Step 2:** `drawNode` — remove selected/hovered from stroke color/width; keep status/data/active cues.
- [x] **Step 3:** Add `drawHoverOverlay(bounds)` (or document reuse of `drawSelectionOverlay` with a lighter stroke) for hovered nodes.
- [x] **Step 4:** Update fake renderers; commit

```text
feat(render): overlay-only beginFrame and decouple root select stroke
```

---

### Task 2: Network dual paint flags + overlay pass

**Files:** `src/network/network.ts`, `src/interaction/types.ts`

- [x] **Step 1:** Replace single `needsPaint` with `needsScenePaint` / `needsOverlayPaint` (or derive `needsPaint` as OR).
- [x] **Step 2:** Implement `requestOverlayPaint`; make `requestPaint` call it.
- [x] **Step 3:** Extract `paintOverlayPass(renderer)` — selection rings, hover ring, highlight edges, `overlayChrome`.
- [x] **Step 4:** Scene path: `beginFrame(cam, dirtyRects|'all')` → bodies only → always run overlay pass → `endFrame`.
- [x] **Step 5:** Overlay-only path: `beginFrame(cam, 'overlay')` → overlay pass → `endFrame`; **never** `dirty.markAll()`.
- [x] **Step 6:** `setSelection` / `setHover` → `requestOverlayPaint` only (still emit events).
- [x] **Step 7:** Camera / resize / load / nav / paint error / drag filter → scene + overlay as today.
- [x] Commit

```text
feat(network): scene vs overlay paint channels
```

---

### Task 3: Interaction call sites + tests

**Files:** `move-node.ts`, `marquee-select.ts`, `create-edge.ts`, `resize-node.ts`, `tests/paint-channels.spec.ts`, existing interaction tests

- [x] Replace chrome `requestPaint` with `requestOverlayPaint` (behavior identical if alias, but tests assert overlay mode).
- [x] New test: register chrome / setSelection / setHover → fake renderer sees `beginFrame(..., 'overlay')` and no scene draw calls.
- [x] New test: `updateCamera` → `beginFrame(..., 'all')` (or markAll path).
- [x] Fix any snapshot/demo expectations if select stroke color assertions exist.
- [x] Commit

```text
test(network): cover overlay-only paint channel
```

---

### Task 4: Docs + promote Agent Note

- [x] Gap backlog: add/complete “overlay-only paint channel” under engine debt / suggested waves.
- [x] README: link Wave E note + checklist; note select/hover body-stroke change if visible.
- [x] Move Agent Note to `implemented/architecture/`; rewrite `## Proposal` → `## Decision`, fold acceptance into `## Consequences` / `## Testing`.
- [x] `pnpm run verify-notes`.
- [x] Commit

```text
docs: promote Wave E paint-channels Agent Note
```

---

## Verify

```sh
pnpm test
pnpm run typecheck
pnpm run verify-notes
```

## Explicit non-goals this wave

- Narrowing `previewNodePosition` / `previewNodeBounds` away from `markAll`.
- Diff-based `GraphScene.commitActive` dirty ids.
- Thickening Views with label/alarm facets.

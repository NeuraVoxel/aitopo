# AITopo Wave A — View cache, injectable Renderer, alarmChanged

> **Owning decision:** [.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md](../.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md) (ai-eng Agent Note). This file is the **execution checklist** only — file map, task steps, verify commands. Do not treat it as the decision home.

> **For agentic workers:** Wave A has shipped on `refactor`. Historical task steps remain below for audit. Clean-room: **no** SDK2D imports, **no** twaver public API names.

**Goal:** Close the Phase-1 design gap by giving each graph element a cached View lifecycle, making `Renderer` injectable at mount, and emitting `alarmChanged` when alarm patches apply — without changing the Document/Patch/Events dual-face model.

**Architecture:** Keep pure geometry in `src/ui/bounds.ts`. Add package-private View classes that own dirty flags + cached paint/hit geometry. `Network.validate()` asks Views for paint inputs instead of rebuilding bounds every frame. Extend the `Renderer` interface so overlay chrome is not `instanceof Canvas2DRenderer`-gated. Emit one `alarmChanged` per `setAlarms` op after a successful `apply`.

**Tech Stack:** TypeScript ESM, vitest (`environment: 'node'`), existing Canvas2D path. Ideas only from `/home/jeff/Documents/AI/coding-agent/SDK2D/twaver/vector/` ElementUI invalidate/validate (new names).

**Requirements / context:** [design](./2026-09-07-aitopo-design.md), [gap backlog](./2026-09-09-aitopo-twaver-vector-gap.md), [SDK2D path note](../.agents/notes/implemented/process/2026-09-10-sdk2d-design-reference-path.md), [Wave A decision](../.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md).

**Out of scope (Wave B+):** Overlay marker protocol, lazy-move ghost, drop-target group highlight, resize/rotate handles, Attachment tree, pixel hit-test, Logical/Mixed zoom, Overview, HTML UI.

---

## File map

| Path | Role after Wave A |
|---|---|
| `src/ui/bounds.ts` | Unchanged pure helpers (`nodeBounds`, `edgeAnchors`, hit-tests) |
| `src/ui/node-view.ts` | **Create** — `NodeView` dirty / validate / paint input / hit |
| `src/ui/edge-view.ts` | **Create** — `EdgeView` (depends on endpoint node positions) |
| `src/ui/group-view.ts` | **Create** — `GroupView` |
| `src/ui/view-set.ts` | **Create** — sync create/dispose/markDirty from `GraphScene` |
| `src/ui/index.ts` | Re-export Views + `ViewSet` (package-private consumers; public barrel stays lean) |
| `src/render/canvas2d.ts` | Move overlay methods onto `Renderer`; keep `Canvas2DRenderer` impl |
| `src/network/network.ts` | Own `ViewSet`; inject renderer; validate via Views; emit `alarmChanged` |
| `src/index.ts` | Export `Renderer` factory option types only if already public; do **not** export View classes |
| `tests/view-set.spec.ts` | **Create** — View dirty/validate/cache behavior |
| `tests/network-renderer.spec.ts` | **Create** — injectable fake Renderer + overlay calls |
| `tests/alarm-events.spec.ts` | **Create** — `alarmChanged` on `setAlarms` |
| `docs/2026-09-09-aitopo-twaver-vector-gap.md` | Mark View extract + `alarmChanged` `done` |
| `docs/2026-09-07-aitopo-design.md` | Note Views are implemented (facts only) |
| `.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md` | Decision record (promoted from proposed) |

---

## Design contracts

### View lifecycle (per element)

```ts
// Conceptual — names in source must match files above
interface ElementView {
  readonly id: string
  markDirty(): void
  /** Recompute cached geometry from the live scene when dirty. */
  validate(scene: GraphScene): void
  /** World-space bounds used for dirty-rect union and hit-test. */
  readonly bounds: Rect
}
```

- `NodeView.validate` caches `nodeBounds(node)` and selection/hover flags are **not** stored on the View for paint — Network passes them when building `NodePaintView` (selection can change without geometry dirty). Geometry dirty ≠ chrome dirty.
- `EdgeView.validate` reads endpoint nodes via `scene.nodes`; if either endpoint is missing, mark inactive and skip paint/hit.
- `GroupView.validate` caches `groupBounds(group)`.
- Moving a node marks that `NodeView` dirty **and** every incident `EdgeView` dirty (use `scene` adjacency / scan edges once in `ViewSet.markNodeMoved`).
- `load` / full document replace: `ViewSet.rebuild(scene)` dispose+create all; `invalidateAll` paint.
- Views stay `@internal` — not in public `src/index.ts` exports.

### Paint path after Wave A

```
scene mutation → ViewSet.sync / markDirty
→ Network.syncDirtyFromScene uses view.bounds (after validate) for DirtyAccumulator
→ rAF validate():
    ViewSet.validateDirty(scene)
    renderer.beginFrame(...)
    for each group/edge/node (respect dragPaintFilter):
      view.validate if needed; renderer.draw*(model, view.toPaintView(selected, hovered))
    renderer.drawSelectionOverlay / drawMarquee / drawEdgeRubberBand (on Renderer)
    endFrame
```

### Renderer injection

```ts
export interface NetworkOptions {
  // ...existing...
  /**
   * Build the paint backend after canvases exist.
   * Default: Canvas2DRenderer with the mounted root/overlay canvases.
   */
  readonly createRenderer?: (canvases: {
    readonly root: HTMLCanvasElement
    readonly overlay: HTMLCanvasElement
    readonly debugPaintRects: boolean
  }) => Renderer
}
```

Extend `Renderer`:

```ts
interface Renderer {
  beginFrame(...): void
  drawGroup(...): void
  drawEdge(...): void
  drawNode(...): void
  endFrame(): void
  /** Overlay: selection ring (no-op OK for headless fakes). */
  drawSelectionOverlay(bounds: Rect): void
  drawMarquee(rect: Rect): void
  drawEdgeRubberBand(from: Point, to: Point): void
  setDebugPaintRects?(value: boolean): void
}
```

Remove all `renderer instanceof Canvas2DRenderer` branches from `Network.validate`.

### alarmChanged

After successful `scene.apply` in `Network.apply`, for each op where `op.op === 'setAlarms'`:

```ts
this.emit({
  type: 'alarmChanged',
  elementId: op.elementId,
  alarms: op.alarms, // or scene.alarmsOf(op.elementId) post-apply — prefer scene truth
})
```

Still emit `documentChanged` as today. No emit on `load` unless product later asks (out of scope). `updateNode` that embeds `alarms` — if schema allows — either emit too or document that only `setAlarms` notifies; **prefer only `setAlarms`** to match protocol op name.

---

### Task 1: alarmChanged emission (smallest, shippable alone)

**Files:**
- Modify: `src/network/network.ts` (`apply`)
- Create: `tests/alarm-events.spec.ts`
- Modify: `docs/2026-09-09-aitopo-twaver-vector-gap.md` (alarm row → keep until Task 1 done, then `done`)

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'

describe('alarmChanged', () => {
  it('emits alarmChanged for each setAlarms op after apply', () => {
    const network = new Network()
    network.load({
      version: 1,
      nodes: [{ id: 'n1', x: 0, y: 0 }],
      edges: [],
    })
    const handler = vi.fn()
    network.on(handler)
    network.apply({
      ops: [{
        op: 'setAlarms',
        target: 'node',
        elementId: 'n1',
        alarms: [{ level: 'error', message: 'boom' }],
      }],
    })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alarmChanged',
        elementId: 'n1',
      }),
    )
    const alarmEvent = handler.mock.calls
      .map(c => c[0])
      .find(e => e.type === 'alarmChanged')
    expect(alarmEvent.alarms).toEqual([
      expect.objectContaining({ level: 'error', message: 'boom' }),
    ])
  })
})
```

Adjust `Alarm` field names to match `src/protocol/types.ts` exactly.

- [ ] **Step 2: Run test — expect fail** (`Network` never emits `alarmChanged`)

```sh
pnpm test -- tests/alarm-events.spec.ts
```

- [ ] **Step 3: Implement emit loop in `Network.apply` after `scene.apply`**

Use `scene.alarmsOf(elementId)` for payload so hosts see post-apply truth.

- [ ] **Step 4: Re-run test — expect pass**

- [ ] **Step 5: Commit**

```text
fix(network): emit alarmChanged on setAlarms patches
```

---

### Task 2: Expand Renderer interface (overlay methods)

**Files:**
- Modify: `src/render/canvas2d.ts` (`Renderer` + ensure methods exist on class)
- Modify: `src/network/network.ts` (`validate` — call interface methods; drop `instanceof`)
- Create: `tests/network-renderer.spec.ts` (partial — fake renderer capture)

- [ ] **Step 1: Write failing test with fake Renderer**

Mount is DOM-heavy. Prefer testing via injecting `createRenderer` **after** Task 3 wires options; for this task, either:

**Option A (preferred):** unit-test that `Canvas2DRenderer` satisfies the widened interface (typecheck + call overlay methods with a jsdom/canvas mock if available), **and** change `network.ts` to stop using `instanceof` so a structural fake compiles.

**Option B:** defer the injectable test to Task 3; this task only widens the interface and removes `instanceof`.

Choose **Option B** if canvas mocks are painful in vitest node env.

- [ ] **Step 2: Add overlay methods to `Renderer`; keep existing Canvas2D implementations**

- [ ] **Step 3: Replace `instanceof Canvas2DRenderer` in `validate` with direct calls**

- [ ] **Step 4: `pnpm run typecheck` && `pnpm test`**

- [ ] **Step 5: Commit**

```text
refactor(render): put overlay chrome on Renderer interface
```

---

### Task 3: Injectable `createRenderer`

**Files:**
- Modify: `src/network/network.ts` (`NetworkOptions`, `mount`)
- Modify: `tests/network-renderer.spec.ts`

- [ ] **Step 1: Failing test — createRenderer is invoked with root/overlay**

If full `mount` needs `document`, use vitest + happy-dom/jsdom if already configured; else test a package-private helper `resolveRenderer(options, canvases)` extracted for purity:

```ts
export function resolveRenderer(
  options: NetworkOptions,
  canvases: { root: HTMLCanvasElement; overlay: HTMLCanvasElement; debugPaintRects: boolean },
): Renderer {
  return options.createRenderer?.(canvases) ?? new Canvas2DRenderer({
    root: canvases.root,
    overlay: canvases.overlay,
    ...(canvases.debugPaintRects ? { debugPaintRects: true } : {}),
  })
}
```

Test `resolveRenderer` with a fake that records args. Keep helper next to Network or in `network.ts` as exported-for-tests only if needed — prefer testing through public `NetworkOptions` once DOM is available in demo smoke; unit-test `resolveRenderer` is enough for Wave A.

- [ ] **Step 2: Implement `createRenderer` option + default**

- [ ] **Step 3: Type field `renderer: Renderer | null` (not `Canvas2DRenderer | null`)**

`setDebugPaintRects` uses optional chaining on `setDebugPaintRects?.`.

- [ ] **Step 4: Verify typecheck + tests**

- [ ] **Step 5: Commit**

```text
feat(network): allow injecting Renderer via createRenderer
```

---

### Task 4: NodeView / EdgeView / GroupView + ViewSet

**Files:**
- Create: `src/ui/node-view.ts`, `edge-view.ts`, `group-view.ts`, `view-set.ts`
- Modify: `src/ui/index.ts`
- Create: `tests/view-set.spec.ts`

- [ ] **Step 1: Failing tests for ViewSet**

```ts
it('rebuild creates one view per node/edge/group', () => { /* ... */ })
it('markNodeGeometryDirty dirties incident edges', () => { /* ... */ })
it('validate is idempotent until markDirty', () => {
  // spy or version counter on validate body — prefer checking cached bounds reference equality
})
it('sync after remove disposes missing ids', () => { /* ... */ })
```

- [ ] **Step 2: Implement View classes calling `nodeBounds` / `edgeAnchors` / `groupBounds`**

Keep paint DTO builders:

```ts
nodeView.toPaintView(selected: boolean, hovered: boolean): NodePaintView
edgeView.toPaintView(selected: boolean, hovered: boolean): EdgePaintView
groupView.toPaintView(): GroupPaintView
```

- [ ] **Step 3: ViewSet API**

```ts
class ViewSet {
  rebuild(scene: GraphScene): void
  sync(scene: GraphScene): void  // add/remove to match maps
  markDirty(id: string): void
  markNodeGeometryDirty(scene: GraphScene, nodeId: string): void
  validateDirty(scene: GraphScene): void
  getNode(id: string): NodeView | undefined
  // ... edge/group + iterators for paint order
}
```

- [ ] **Step 4: Run `pnpm test -- tests/view-set.spec.ts`**

- [ ] **Step 5: Commit**

```text
feat(ui): add Node/Edge/Group View cache and ViewSet
```

---

### Task 5: Wire ViewSet into Network paint + dirty + hit-test

**Files:**
- Modify: `src/network/network.ts`
- Modify: `tests/geom-layout.spec.ts` / `tests/network-editor-helpers.spec.ts` if hit paths change
- Modify: existing interaction tests only if behavior drifts (should not)

- [ ] **Step 1: On `load` / `apply` / `writePositions` / preview move — keep ViewSet in sync and mark dirty**

- [ ] **Step 2: `syncDirtyFromScene` — after `ViewSet.validateDirty`, union `view.bounds` (grown) into `DirtyAccumulator`**

- [ ] **Step 3: Rewrite `validate()` paint loops to use Views + `toPaintView`**

Preserve: dragPaintFilter, hover-related data-edge highlight, marquee / rubber-band overlay, paint-failure → `markAll`.

- [ ] **Step 4: Optionally route `hitTestScreen` / `hitTestGroupScreen` through validated view bounds**

Keep using `hitTestNodes` / `hitTestEdges` helpers **or** view.bounds with same padding — do not change hit semantics in Wave A. If Views are used, add a regression assert in `network-editor-helpers.spec.ts`.

- [ ] **Step 5: Full package test + typecheck**

```sh
pnpm test
pnpm run typecheck
```

- [ ] **Step 6: Commit**

```text
refactor(network): paint and dirty-rect through ViewSet
```

---

### Task 6: Promote Agent Note + gap backlog

**Files:**
- Move + rewrite: `.agents/notes/proposed/architecture/2026-09-10-wave-a-view-renderer-alarms.md` → `implemented/architecture/` (`Status: implemented`; `## Proposal` → `## Decision`; fold acceptance/risks into `## Consequences` / `## Testing`)
- Modify: `docs/2026-09-09-aitopo-twaver-vector-gap.md` — View extract + `alarmChanged` → `done`
- Modify: `docs/2026-09-07-aitopo-design.md` — Views live under `src/ui/` (facts only)
- Modify: `README.md` — Known Limitations / design links if alarm or View wording changes
- Modify: this checklist header link if the note path changes

- [ ] **Step 1: Promote the existing proposed Agent Note (do not create a second note)**

Follow [Agent Note lifecycle move rules](../.agents/notes/README.md#moving-between-lifecycles). Keep Alternatives; state shipped paths and verification in present tense.

- [ ] **Step 2: Update gap backlog status rows**

- [ ] **Step 3: `pnpm run verify-notes`**

- [ ] **Step 4: Commit**

```text
docs: promote Wave A Agent Note and update gap backlog
```

---

## Verify gates (every task)

```sh
pnpm test
pnpm run typecheck
```

When notes change:

```sh
pnpm run verify-notes
```

Manual smoke (after Task 5): `pnpm run demo` — Editor move/marquee/alarms badge still paint; Debug dirty still meaningful.

---

## Done when

1. `setAlarms` produces `alarmChanged` with scene-truth alarms.
2. `NetworkOptions.createRenderer` can supply a fake `Renderer`; default remains Canvas2D.
3. `Network.validate` never uses `instanceof Canvas2DRenderer`.
4. Element geometry is validated through `ViewSet`; dirty-rect unions use view bounds.
5. Public API still does not export twaver names or View classes.
6. Gap backlog marks View extract + `alarmChanged` as `done`; Agent Note exists.

---

## Suggested PR split

| PR | Tasks | Why |
|---|---|---|
| PR1 | Task 1 | Tiny behavior fix, easy review |
| PR2 | Tasks 2–3 | Renderer contract |
| PR3 | Tasks 4–6 | View extraction + docs |

Independent stacks may merge-forward; do not rewrite PR1 history after PR2 lands without need.

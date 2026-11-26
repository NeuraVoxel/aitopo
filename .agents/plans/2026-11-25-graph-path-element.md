# GraphPath Freestanding Path Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan location note:** This repository places planning artifacts under `.agents/plans/` (not `docs/superpowers/plans/`) per `AGENTS.md`.
>
> **Commits:** Do **not** `git commit` or `git push` unless the user explicitly asks. Checkbox “commit” steps mean: stop and offer a commit summary for approval.

**Goal:** Add top-level `GraphPath` (`paths[]`) with paint, hit-test, patch/invert, create/vertex interactions, demo Create Path mode, and flip five ADAS reserved samples to loadable Path documents.

**Architecture:** Path is a first-class document element beside nodes/edges/groups (not an edge and not a node). Densify control points with shared shape sampling (`lineto` / `quadto` / `cubicto`); `PathView` paints under nodes; Network owns commits/events; Create Path + vertex drag mirror Create Edge / bend patterns.

**Tech Stack:** TypeScript, Zod protocol schemas, existing Canvas2D + ViewSet, Vitest, demo React shell.

**Spec:** [`.agents/notes/implemented/feature/2026-11-25-graph-path-element.md`](../notes/implemented/feature/2026-11-25-graph-path-element.md)

## Global Constraints

- Document `version` stays `1`; omitted `paths` ≡ `[]`.
- Fail loud on bad point counts / duplicate ids across node|edge|group|path.
- Do not rewrite `GraphEdge.route: "shape"`; do not implement FOV wedges.
- Path v1 lives on the active (root or current subnetwork) document only — no group membership / collapse remapping.
- Promote the proposed Agent Note to `implemented/` only after Path ships; keep Decision present-tense with what landed.
- Prefer extracting densify helpers from `src/ui/edge-link-route.ts` over duplicating quad/cubic sampling.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/protocol/types.ts` | `PathShapeKind`, `GraphPathStyle`, `GraphPath`; `GraphDocument.paths?` |
| `src/protocol/schema.ts` | Zod for Path + patch ops; document unique-id + point-count gates |
| `src/protocol/patch.ts` | `addPath` / `updatePath` / `removePath` apply |
| `src/protocol/invert.ts` | Inverse ops for Path |
| `src/protocol/index.ts` | Re-exports |
| `src/model/scene.ts` | Path map, load/toJSON, apply ops, `collectPatchDirty` |
| `src/ui/path-route.ts` (or extract in `edge-link-route.ts`) | `buildPathPolyline(points, shapeKind, closed)` densify |
| `src/ui/path-view.ts` | Validate → paint DTO, bounds, hit |
| `src/ui/view-set.ts` | Path views sync/rebuild; paint under nodes; hit paths |
| `src/ui/bounds.ts` | Path hit helpers if needed |
| `src/ui/index.ts` | Export PathView helpers as needed |
| `src/network/network.ts` | getPaths, hit kind `'path'`, paint, commits, selection |
| `src/network/gesture-editor.ts` | `commitPathCreate` / Update / Remove |
| `src/interaction/create-path.ts` | Click-to-add points, commit |
| `src/interaction/move-path-vertex.ts` | Drag control handles |
| `src/interaction/delete-path.ts` (or extend DeleteEdge) | Delete selected path |
| `src/interaction/types.ts` | Host methods for path chrome / hit |
| `src/interaction/index.ts` | Exports |
| `src/index.ts` | Public exports |
| `demo/lib/interactions.ts` | `create-path` mode |
| `demo/components/Toolbar.tsx` | Create Path button |
| `demo/hooks/useNetworkDemo.ts` | Mode wiring |
| `demo/samples/adas/*.ts` | Five loadable Path samples; shrink placeholders |
| `tests/graph-path.spec.ts` | Protocol + densify + view + patch |
| `tests/create-path.spec.ts` | Create / vertex / delete interactions |
| `tests/demo-registry.spec.ts` | ADAS reserved set shrinks |
| `.agents/notes/implemented/feature/2026-11-25-graph-path-element.md` | implemented (promoted Task 8) |
| `README.md` | Path in protocol / demo modes |

---

## Chunk 1: Protocol + scene

### Task 1: Types + Zod + parse tests

**Files:**
- Modify: `src/protocol/types.ts`
- Modify: `src/protocol/schema.ts`
- Modify: `src/protocol/index.ts`
- Create: `tests/graph-path.spec.ts`

- [ ] **Step 1: Write failing parse tests**

In `tests/graph-path.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/index.ts'

describe('GraphPath protocol', () => {
  it('defaults omitted paths to empty array', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
    })
    expect(doc.paths ?? []).toEqual([])
  })

  it('accepts a lineto open path with two points', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{
        id: 'p1',
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        style: { stroke: '#334155', lineWidth: 2, shapeKind: 'lineto' },
      }],
    })
    expect(doc.paths).toHaveLength(1)
    expect(doc.paths![0]!.id).toBe('p1')
  })

  it('rejects path with fewer than two points', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [],
      edges: [],
      paths: [{ id: 'p1', points: [{ x: 0, y: 0 }] }],
    })).toThrow()
  })

  it('rejects path id that collides with a node id', () => {
    expect(() => parseDocument({
      version: 1,
      nodes: [{ id: 'same', type: 'n', label: 'N', x: 0, y: 0 }],
      edges: [],
      paths: [{ id: 'same', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    })).toThrow()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm exec vitest run --config vitest.config.ts tests/graph-path.spec.ts
```

Expected: FAIL (no `paths` on document / schema).

- [ ] **Step 3: Add types**

In `src/protocol/types.ts` (near edge shape kinds):

```ts
/** Freestanding path segment interpolation (no edge endpoints). */
export type PathShapeKind = 'lineto' | 'quadto' | 'cubicto'

export interface GraphPathStyle {
  readonly stroke?: string
  readonly lineWidth?: number
  readonly strokeDash?: readonly number[]
  readonly alpha?: number
  /** Omitted → `lineto`. */
  readonly shapeKind?: PathShapeKind
  /** Fill when `closed: true`. */
  readonly fill?: string
  readonly label?: GraphTextStyle
  readonly select?: GraphChromeStyle
  readonly hover?: GraphChromeStyle
}

/** Freestanding stroke / optional closed ring — not a GraphEdge. */
export interface GraphPath {
  readonly id: string
  readonly points: readonly { readonly x: number; readonly y: number }[]
  readonly closed?: boolean
  readonly label?: string
  readonly tooltip?: string
  readonly locked?: boolean
  readonly style?: GraphPathStyle
  readonly data?: Readonly<Record<string, unknown>>
}
```

Extend `GraphDocument`:

```ts
readonly paths?: readonly GraphPath[]
```

- [ ] **Step 4: Add Zod schema + document refine**

In `src/protocol/schema.ts`: add `graphPathStyleSchema`, `graphPathSchema` (min 2 points); include `paths: z.array(graphPathSchema).optional()` on document; refine:

- unique ids across nodes, edges, groups, paths
- for each path, validate point arity vs `style.shapeKind` (lineto: ≥2; quadto: odd count ≥3 typical of edge densify pairing — match `buildShapeRoute` expectations and fail loud on remainder)

- [ ] **Step 5: Re-export types from `src/protocol/index.ts` and `src/index.ts`**

- [ ] **Step 6: Run tests — expect PASS** for Task 1 cases

```bash
pnpm exec vitest run --config vitest.config.ts tests/graph-path.spec.ts
```

- [ ] **Step 7: Offer commit** (only if user asks) — `feat(protocol): add GraphPath types and parse`

---

### Task 2: Patch apply + invert + GraphScene

**Files:**
- Modify: `src/protocol/schema.ts` (patch ops)
- Modify: `src/protocol/patch.ts`
- Modify: `src/protocol/invert.ts`
- Modify: `src/model/scene.ts`
- Modify: `tests/graph-path.spec.ts`

- [ ] **Step 1: Extend failing tests**

```ts
import { applyPatch, invertPatch, parseDocument } from '../src/protocol/index.ts'
import { GraphScene } from '../src/model/index.ts'

it('addPath / updatePath / removePath round-trip with invert', () => {
  const empty = parseDocument({ version: 1, nodes: [], edges: [] })
  const added = applyPatch(empty, {
    ops: [{
      op: 'addPath',
      path: { id: 'p1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    }],
  })
  expect(added.paths).toHaveLength(1)
  const updated = applyPatch(added, {
    ops: [{
      op: 'updatePath',
      id: 'p1',
      patch: { points: [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 0 }] },
    }],
  })
  expect(updated.paths![0]!.points).toHaveLength(3)
  const inverse = invertPatch(added, {
    ops: [{
      op: 'updatePath',
      id: 'p1',
      patch: { points: [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 0 }] },
    }],
  })
  const back = applyPatch(updated, { ops: inverse })
  expect(back.paths![0]!.points).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  const removed = applyPatch(added, { ops: [{ op: 'removePath', id: 'p1' }] })
  expect(removed.paths ?? []).toEqual([])
})

it('GraphScene load/toJSON preserves paths', () => {
  const scene = new GraphScene()
  scene.load(parseDocument({
    version: 1,
    nodes: [],
    edges: [],
    paths: [{
      id: 'lane',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      closed: false,
      style: { strokeDash: [6, 4] },
    }],
  }))
  expect(scene.toJSON().paths?.map(p => p.id)).toEqual(['lane'])
})
```

- [ ] **Step 2: Run — expect FAIL** on unknown patch ops / scene paths

- [ ] **Step 3: Implement patch ops**

Schema:

```ts
z.object({ op: z.literal('addPath'), path: graphPathSchema }),
z.object({
  op: z.literal('updatePath'),
  id: z.string().min(1),
  patch: graphPathSchema.partial().omit({ id: true }),
}),
z.object({ op: z.literal('removePath'), id: z.string().min(1) }),
```

`applyPatch`: mirror edge add/update/remove (whole `points` replace on update when provided).  
`invertOp`: mirror edge invert (clone path).  
`GraphScene`: `pathMap`, getters, load/toJSON include `paths`, apply three ops, `collectPatchDirty` adds path ids for add/update/removePath.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Offer commit** — `feat(protocol): GraphPath patch apply and scene storage`

---

## Chunk 2: Geometry + PathView + Network paint/hit

### Task 3: Densify helper + PathView

**Files:**
- Create or modify: `src/ui/path-route.ts` (preferred) exporting `buildPathPolyline`
- Optionally refactor: `src/ui/edge-link-route.ts` to call shared densify for middle points
- Create: `src/ui/path-view.ts`
- Modify: `tests/graph-path.spec.ts`

- [ ] **Step 1: Failing densify / bounds tests**

```ts
import { buildPathPolyline } from '../src/ui/path-route.ts'

it('buildPathPolyline lineto returns control points', () => {
  const pts = buildPathPolyline(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    'lineto',
    false,
  )
  expect(pts).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ])
})

it('buildPathPolyline closed appends closure for hit/paint consumers', () => {
  const pts = buildPathPolyline(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    'lineto',
    true,
  )
  expect(pts[0]).toEqual(pts[pts.length - 1])
})
```

Implement `buildPathPolyline(points, kind, closed)` using the same sampling as `buildShapeRoute` but **without** injecting from/to boxes — densify `points` as the full control polyline; if `closed`, ensure last equals first for stroke close / fill.

- [ ] **Step 2: PathView unit behavior**

`PathView` API mirror `EdgeView` enough for ViewSet:

- `sync(path: GraphPath): void`
- `paintDTO` / bounds for dirty-rect
- `hit(worldX, worldY, threshold): boolean` — distance to densified segments; if `closed && fill`, also point-in-polygon

- [ ] **Step 3: Tests PASS**

---

### Task 4: ViewSet + Network hit/paint/selection

**Files:**
- Modify: `src/ui/view-set.ts`
- Modify: `src/network/network.ts`
- Modify: `src/network/gesture-editor.ts` (if hit helpers live there)
- Modify: interaction host types so `hitTest` kind includes `'path'`
- Modify: `tests/graph-path.spec.ts` (Network mount smoke if feasible with existing test harness)

- [ ] **Step 1: Extend hit kind**

Change hit results from `'node' | 'edge' | 'group'` to `'node' | 'edge' | 'group' | 'path'` everywhere they are defined (Network, InteractionHost, SelectActivate, etc.). Update exhaustive switches.

- [ ] **Step 2: ViewSet**

- `paths: Map<string, PathView>`
- `rebuild` / `sync` from `scene.paths`
- Paint order: **paths → edges → nodes/groups** (lanes under cars). Confirm against current edge/node order and adjust so paths are below nodes.
- `hitTest`: after nodes/groups (top), then edges, include paths (or hit nodes first then paths — nodes must win when overlapping)

Recommended pick order (screen top → bottom): node → group → edge → path (path lowest priority when stacked).

- [ ] **Step 3: Network**

- `getPaths()`, selection works with path ids
- `commitPathCreate` / `commitPathUpdate` / `commitPathRemove` → apply patch + emit `pathCreated` | `pathUpdated` | `pathRemoved`
- Overlay: selected path control-point handles (world points from `path.points`)
- Body drag: if selection is a single unlocked path, translate all points via `updatePath` (can land in Task 5 with MoveNode extension — if MoveNode ignores non-nodes, add path branch or small `MovePathInteraction`)

- [ ] **Step 4: Tests** — selection setSelection with path id; commitPathCreate returns id

- [ ] **Step 5: Offer commit** — `feat(network): paint and hit GraphPath`

---

## Chunk 3: Interactions + demo

### Task 5: CreatePath + MovePathVertex + Delete

**Files:**
- Create: `src/interaction/create-path.ts`
- Create: `src/interaction/move-path-vertex.ts`
- Modify: `src/interaction/delete-edge.ts` **or** create `delete-path.ts` and pack both in Edit mode (prefer extending delete to remove selected path ids too — one Delete key handler)
- Modify: `src/interaction/types.ts`, `index.ts`, `src/index.ts`
- Create: `tests/create-path.spec.ts` (follow `tests/create-edge.spec.ts` host mock pattern)

- [ ] **Step 1: Failing CreatePath tests** (mock InteractionHost like create-edge)

Behavior:

- pointerdown on empty → start draft with first point
- pointerdown → append point
- double-click or `Enter` → `commitPathCreate({ points, style?: { shapeKind: 'lineto' } })`
- `Esc` → cancel, clear chrome
- rubber-band line from last point to cursor via overlay chrome

- [ ] **Step 2: Implement CreatePathInteraction**

- [ ] **Step 3: MovePathVertexInteraction**

- When selected id is a path, draw handles; pointer on handle → drag → `commitPathUpdate` with new `points`
- Ignore locked paths

- [ ] **Step 4: Delete**

- Delete/Backspace removes selected paths (and keep existing edge delete behavior)

- [ ] **Step 5: Path body translate**

- Either extend `MoveNodeInteraction` to move path points when kind is path, or dedicated handler in Edit stack **before** pan

- [ ] **Step 6: Tests PASS**

- [ ] **Step 7: Offer commit** — `feat(interaction): create and edit GraphPath`

---

### Task 6: Demo Create Path mode

**Files:**
- Modify: `demo/lib/interactions.ts` — add `'create-path'`
- Modify: `demo/components/Toolbar.tsx`
- Modify: `demo/hooks/useNetworkDemo.ts`
- Modify: `README.md` modes table

- [ ] **Step 1: Mode wiring**

```ts
export type DemoMode = 'observe' | 'edit' | 'create-node' | 'create-link' | 'create-path'

case 'create-path':
  return [
    new DeleteEdgeInteraction(), // or shared delete that also clears paths
    new CreatePathInteraction(),
  ]
case 'edit':
  return [
    // ...existing
    new MovePathVertexInteraction(),
    new CreatePathInteraction(), // optional: only if product wants path create in edit; spec says Create Path exclusive mode — keep create exclusive, edit gets vertex+delete+body move only
  ]
```

Per spec: exclusive **Create Path** mode; Edit gets handles + Delete. Do **not** require CreatePath inside Edit unless needed for Alt-less parity — stick to exclusive mode + Edit vertex/delete/move.

- [ ] **Step 2: Toolbar button “Create Path”**

- [ ] **Step 3: Manual check** — `pnpm run demo` → Create Path → click-click-dblclick → path appears; Edit → drag vertex; Delete removes

- [ ] **Step 4: Offer commit** — `feat(demo): Create Path mode`

---

## Chunk 4: ADAS samples + note promotion

### Task 7: Flip five ADAS reserved samples

**Files:**
- Create loadable docs (or replace stubs) under `demo/samples/adas/`:
  - `lane-lines.ts`
  - `lane-centerline.ts`
  - `road-boundary.ts`
  - `planning-path.ts`
  - `prediction.ts`
- Modify: `demo/samples/adas/placeholders.ts` — only `adas-sensor-fov` remains reserved
- Modify: `demo/samples/adas/index.ts` — import loadable samples
- Modify: `tests/demo-registry.spec.ts`
- Modify: `.agents/notes/implemented/feature/2026-11-25-demo-adas-group.md` table
- Modify: README ADAS blurb

**Sample content guidelines:**

- `adas-lane-lines`: 2–3 open `lineto` paths, dashed vs solid via `strokeDash`, ego node optional
- `adas-lane-centerline`: center paths + optional successor edges between lane marker nodes if useful
- `adas-road-boundary`: left/right boundary paths
- `adas-planning-path`: one `cubicto` or `quadto` path ahead of ego
- `adas-prediction`: 2–3 paths from a surround agent with different `alpha` / dash

- [ ] **Step 1: Author documents + registry**

- [ ] **Step 2: Update demo-registry expectations** — reserved only `adas-sensor-fov`

- [ ] **Step 3: `pnpm exec vitest run tests/demo-registry.spec.ts tests/graph-path.spec.ts tests/create-path.spec.ts`**

---

### Task 8: Promote Agent Note + gap doc + exports sweep

**Files:**
- Move/rewrite: `.agents/notes/proposed/feature/2026-11-25-graph-path-element.md` → `implemented/feature/` with `Status: implemented`, `## Decision` (present tense), drop Proposal/Acceptance criteria/Risks into Decision/Consequences/Testing
- Modify: `docs/2026-09-09-aitopo-twaver-vector-gap.md` — ShapeLink create / freestanding path notes
- Modify: `src/index.ts` — export Path types + interactions
- Run: `pnpm test && pnpm run verify-notes`

- [x] **Step 1: Promote note**

- [x] **Step 2: Full test + verify-notes**

```bash
pnpm test && pnpm run verify-notes
```

Expected: all pass; note count includes implemented Path note.

- [ ] **Step 3: Offer final commit** — `feat: GraphPath freestanding paths + ADAS samples` (await user approval; do not commit automatically)

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| `paths: GraphPath[]` top-level | 1 |
| lineto / quadto / cubicto + closed | 1, 3 |
| PathView paint + fill + hit | 3, 4 |
| Paint under nodes | 4 |
| Patch add/update/remove + invert | 2 |
| Network commits + events + selection | 4 |
| CreatePathInteraction | 5, 6 |
| MovePathVertex + body move + Delete | 5 |
| Demo Create Path | 6 |
| ADAS five sample flip | 7 |
| sensor-fov still reserved | 7 |
| Non-goals (no edge shape rewrite, no FOV) | respected throughout |
| Agent Note promote | 8 |

## Placeholder / consistency self-review

- No TBD steps; point-count rules for quad/cubic must match whatever `buildPathPolyline` implements — document the exact rule in Task 1 schema comments once densify lands (Task 3), and align parse refine in the same PR if Task 1 used a temporary ≥2-only check.
- Hit kind `'path'` must be updated exhaustively (Task 4) before SelectActivate ships with Path.
- Commit steps require explicit user approval per `AGENTS.md`.

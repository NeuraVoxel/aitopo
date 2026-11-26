# GraphShapeNode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan location note:** Plans live under `.agents/plans/` per `AGENTS.md`.
>
> **Commits:** Do **not** `git commit` / `git push` unless the user explicitly asks.

**Goal:** Add top-level `shapeNodes: GraphShapeNode[]` (twaver ShapeNode-inspired): densify polygon/polyline node bodies, group membership, patch/create/vertex UX, demo Create ShapeNode + Elements showcase.

**Architecture:** First-class element beside nodes/edges/groups/paths — not a `GraphNode` box and not a `GraphPath`. Reuse `buildPathPolyline` / PathView paint-hit patterns; hit/paint with nodes; edges still endpoint node|group only in v1.

**Tech Stack:** TypeScript, Zod, Canvas2D + ViewSet, Vitest, demo React shell.

**Spec:** [`.agents/notes/implemented/feature/2026-11-26-graph-shape-node.md`](../notes/implemented/feature/2026-11-26-graph-shape-node.md)

## Global Constraints

- Document `version` stays `1`; omitted `shapeNodes` ≡ `[]`.
- `closed` default **true** at create / when interpreting paint if omitted at runtime (document field may still be omitted ≡ true in Decision — pin: **omitted means closed for ShapeNode**, opposite of Path’s open default).
- Unique ids across node | edge | group | path | shapeNode.
- No `x/y/w/h` box body; no rotate; ShapeNode **not** valid edge from/to.
- Mirror GraphPath file/test patterns; prefer shared densify over copy-paste.
- Promote proposed Agent Note only after ship.

**Default closed semantics:** Spec says `closed?: boolean` default true. Implement parse/runtime: `closed !== false` → closed (omit ≡ closed). Document in types JSDoc.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/protocol/types.ts` | `GraphShapeNodeStyle`, `GraphShapeNode`; `GraphDocument.shapeNodes?` |
| `src/protocol/schema.ts` | Zod + patch ops; arity; cross-kind ids |
| `src/protocol/parse.ts` | Cross-kind clash includes shapeNode |
| `src/protocol/patch.ts` / `invert.ts` | add/update/removeShapeNode |
| `src/model/scene.ts` | shapeNodeMap, load/toJSON, dirty, group member ids |
| `src/ui/shape-node-view.ts` | ShapeNodeView (densify via path-route) |
| `src/ui/view-set.ts` | shape node views; paint with nodes; hit with nodes |
| `src/render/canvas2d.ts` | drawShapeNode (may reuse drawPath DTO) |
| `src/network/network.ts` / `gesture-editor.ts` | get/commit/events/handles |
| `src/protocol/events.ts` | shapeNodeCreated/Updated/Removed |
| `src/interaction/create-shape-node.ts` | CreateShapeNodeInteraction |
| `src/interaction/move-shape-node-vertex.ts` | Vertex drag |
| `src/interaction/move-node.ts` / `delete-edge.ts` | Body move + delete |
| `src/interaction/types.ts` | HitKind `'shapeNode'` |
| `demo/lib/interactions.ts` / Toolbar / useNetworkDemo | `create-shape-node` mode |
| `demo/samples/elements/shape-node.ts` | Elements showcase |
| `tests/graph-shape-node.spec.ts` / `tests/create-shape-node.spec.ts` | Protocol + UX |
| `tests/demo-registry.spec.ts` | Register sample |
| gap doc + Agent Note promote | Task 8 |

---

## Chunk 1: Protocol + scene

### Task 1: Types + Zod + parse

**Files:** `src/protocol/types.ts`, `schema.ts`, `parse.ts`, `index.ts`, `src/index.ts`, `tests/graph-shape-node.spec.ts`

- [x] **Step 1: Failing tests** — omitted `shapeNodes` ≡ []; accept closed polygon ≥3 lineto points; reject &lt;2 points; reject id clash with node/path; accept open `closed: false`; quadto/cubicto arity.

- [x] **Step 2: Types** — as in spec; JSDoc: omitted `closed` ≡ closed for ShapeNode.

- [x] **Step 3: Zod** — `graphShapeNodeObjectSchema` + refined schema (mirror Path); document `shapeNodes` optional; arity refine.

- [x] **Step 4: parse cross-kind** — extend `assertNoCrossKindIdClash` for shapeNodes (dup + vs node/edge/group/path).

- [x] **Step 5: Exports + tests PASS**

```bash
pnpm exec vitest run --config vitest.config.ts tests/graph-shape-node.spec.ts
```

---

### Task 2: Patch + invert + GraphScene

**Files:** `schema.ts` (ops), `patch.ts`, `invert.ts`, `scene.ts`, tests

- [x] **Step 1: Tests** — add/update/remove round-trip + invert; GraphScene load/toJSON; merged arity on update; addNode rejects shapeNode id; addShapeNode rejects path id.

- [x] **Step 2: Ops** — `addShapeNode` / `updateShapeNode` / `removeShapeNode`; whole `points` replace; style one-level merge; merged arity assert.

- [x] **Step 3: Scene** — `shapeNodeMap`, getters, load/toJSON, `collectPatchDirty`, group `memberIds` may list shapeNode ids (no prior node-only apply check existed).

- [x] **Step 4: Tests PASS** including existing `tests/patch.spec.ts` / `scene-graph.spec.ts` if present.

---

## Chunk 2: View + Network

### Task 3: ShapeNodeView + densify reuse

**Files:** `src/ui/shape-node-view.ts`, `src/ui/index.ts`, tests

- [x] Reuse `buildPathPolyline(points, kind, closedEffective)`.
- [x] API mirror PathView: `sync`, `hit`, `bounds`, paint getters, `labelPosition`, select/hover style resolution.
- [x] `closedEffective = shapeNode.closed !== false`.
- [x] Tests: hit interior when filled closed; miss outside; open polyline segment hit.

---

### Task 4: ViewSet + Network paint/hit/selection/commits

**Files:** `view-set.ts`, `network.ts`, `gesture-editor.ts`, `events.ts`, `interaction/types.ts`, exhaustive HitKind updates, `canvas2d.ts`

- [x] `HitKind` add `'shapeNode'`.
- [x] Paint order: **paths → groups → edges → shapeNodes → nodes** (kept edges above groups so paint stays inverse of hit; plan pin text said edges before groups).
- [x] Hit order: **nodes → shapeNodes → edges → groups → paths** (nodes win over shapeNodes when stacked).
- [x] Overlay: selection handles on control points; label paint; select/hover chrome like Path.
- [x] `commitShapeNodeCreate/Update/Remove` + events.
- [x] `CreateEdgeInteraction` / endpoint checks: shapeNode ids are **not** valid endpoints.
- [x] Ctrl+A / marquee include shapeNodes.
- [x] Tests: selection, commit create, hitTest, edge create skips shapeNode.

---

## Chunk 3: Interactions + demo

### Task 5: Create / vertex / body / delete

**Files:** `create-shape-node.ts`, `move-shape-node-vertex.ts`, extend `move-node.ts`, `delete-edge.ts`, exports, `tests/create-shape-node.spec.ts`

- [x] CreateShapeNode: click points; Enter/dblclick commit with `closed: true` default, `shapeKind: 'lineto'`; Esc cancel; closed rubber preview.
- [x] MoveShapeNodeVertex: capture-phase like path.
- [x] MoveNode: `hit.kind === 'shapeNode'` → translate points.
- [x] Delete: remove selected shapeNodes.
- [x] Tests PASS (create-edge still green).

---

### Task 6: Demo Create ShapeNode mode

**Files:** `demo/lib/interactions.ts`, `Toolbar.tsx`, `useNetworkDemo.ts`, `README.md`

- [x] Mode `'create-shape-node'`.
- [x] Edit extras: `MoveShapeNodeVertexInteraction` near `MovePathVertexInteraction`.
- [x] Toolbar button **Create ShapeNode**.

---

### Task 7: Elements showcase + optional group member

**Files:** `demo/samples/elements/shape-node.ts`, `registry.ts`, `demo-registry.spec.ts`, README Elements blurb, Agent Note ADAS note optional

Sample content:
- Open polyline (`closed: false`)
- Closed fill triangle/rect
- quadto / cubicto closed or open
- Locked
- One shapeNode inside a Group (`groupId` + `memberIds`)

- [x] Registry after `path` sample (or after group — prefer after `path`: node, edge, path, **shape-node**, group, …).
- [x] Tests assert shapeKinds + group membership + parse.

---

### Task 8: Promote note + gap doc + verify

- [x] proposed → `implemented/feature/2026-11-26-graph-shape-node.md` (Decision present tense).
- [x] `docs/2026-09-09-aitopo-twaver-vector-gap.md`: ShapeNodeUI → `done`; CreateShapeNodeInteraction → `done` (or done subset).
- [x] `pnpm test && pnpm run verify-notes`

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Top-level `shapeNodes` model A | 1 |
| lineto/quad/cubic + closed default true | 1, 3 |
| Group membership | 2, 4, 7 |
| Paint/hit with nodes | 4 |
| Patch + events + commits | 2, 4 |
| CreateShapeNode + vertex + body + delete | 5, 6 |
| Elements sample | 7 |
| Edges not endpoints | 4 |
| Note promote + gap | 8 |

## Self-review notes

- Exhaustive `HitKind` / patch `switch` / invert / collectPatchDirty must include shapeNode.
- Do not treat ShapeNode as Path (no silent reuse of pathMap).
- Commit only with user approval.

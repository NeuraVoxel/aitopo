# Agent Note: GraphPath freestanding path element

Status: implemented

## Problem

ADAS and map-like diagrams need strokes that are **not** graph relations: lane markings, curb boundaries, planning / prediction trajectories. Every stroke used to be a `GraphEdge` with required `from` / `to` node or group ids. Authors could not model freestanding geometry without fake endpoint nodes, which misrepresented the protocol and blocked ADAS demos that needed open or curved strokes without topology.

## Decision

The document carries a first-class **`GraphPath`** in a top-level `paths` array beside `nodes` / `edges` / `groups`. Omitted `paths` ≡ `[]`. Document `version` stays `1`. Paths are not edges: no `from` / `to`.

### Protocol

```ts
paths?: GraphPath[]   // omitted ≡ []

type PathShapeKind = 'lineto' | 'quadto' | 'cubicto'

interface GraphPathStyle {
  stroke?: string
  lineWidth?: number
  strokeDash?: readonly number[]
  alpha?: number
  shapeKind?: PathShapeKind      // default lineto
  fill?: string                  // meaningful when closed
  label?: GraphTextStyle
  select?: GraphChromeStyle
  hover?: GraphChromeStyle
}

interface GraphPath {
  id: string
  points: readonly { readonly x: number; readonly y: number }[]
  closed?: boolean               // default false
  label?: string
  tooltip?: string
  locked?: boolean
  style?: GraphPathStyle
  data?: Readonly<Record<string, unknown>>  // business bag; paint ignores visual keys
}
```

**Invariants (fail loud at parse / apply):**

- `id` unique across nodes, edges, groups, and paths in the active document.
- Point arity vs `style.shapeKind` matches freestanding densify (`buildPathPolyline` / shared with edge shape sampling): `lineto` ≥ 2; `quadto` / `cubicto` segment pairing fails loud on leftover trailing points.
- `updatePath` validates **merged** point arity vs effective `shapeKind`; `addNode` / `addEdge` / `addGroup` reject path-id collisions; path boolean invert mirrors group (`closed` / `locked` omitted ≡ false).

### Patch / Network

| Op | Payload |
|---|---|
| `addPath` | `{ path: GraphPath }` |
| `updatePath` | `{ id, patch }` (partial; `points` replaced as a whole when present) |
| `removePath` | `{ id }` |

`GraphScene` keeps `pathMap` / `paths` through `load` · `toJSON` · `collectPatchDirty`. Network exposes `getPaths` / `getPathBounds` and `commitPathCreate` · `Update` · `Remove` → `pathCreated` / `pathUpdated` / `pathRemoved`.

### Render / hit / selection

- `buildPathPolyline` / `densifyControlPolyline` in `src/ui/path-route.ts`; `PathView` densifies control `points`, computes bounds, and hits densified segments (filled closed paths also hit interior).
- Paint order: document `layers` bottom → top; within each layer filled surfaces → stroke paths → groups → edges → stroke shapeNodes → nodes. Hit pick reverses that. See [graph-layer](2026-11-26-graph-layer.md).
- Selection / hover chrome: edge-like overlay restroke using `style.select` / `style.hover` **color** / **width** / **padding** (padding widens the chrome stroke); **glow** / **glowBlur** apply as stroke `shadowBlur` (select glow default on, hover default off). Selected paths also show **control-point** handles from `path.points` (not densified samples). Not AABB `drawSelectionOverlay` rings (those stay for nodes/groups).
- `label` + `style.label` paint at densified-polyline midpoint with a small upward offset (`PathView.labelPosition` / `PathPaintView.label`); `labelSide` later.
- Unlocked: body drag translates all points; handle drag updates one control point.
- SelectActivate Ctrl+A and marquee include paths.

### Interactions + demo

| Interaction | Behavior |
|---|---|
| `CreatePathInteraction` | Empty-canvas clicks append control points; Enter or double-click commits ≥2 pts; Esc cancels; rubber-band chrome |
| `MovePathVertexInteraction` | Selected unlocked path handle drag → `commitPathUpdate` |
| Body move | `MoveNodeInteraction` translates all path points via `commitPathUpdate` |
| Delete | `DeleteEdgeInteraction` also removes selected paths |

Demo exclusive `'create-path'` mode packs `CreatePathInteraction` + `DeleteEdgeInteraction`; Toolbar **Create Path**. Edit packs `MovePathVertexInteraction` first among extras (capture-phase wins over default `MoveNode`). Public exports: `GraphPath`, `GraphPathStyle`, `PathShapeKind`, `CreatePathInteraction`, `MovePathVertexInteraction`.

### ADAS catalog

| Sample | Path role |
|---|---|
| `adas-lane-lines` | Solid / dashed open lane markings |
| `adas-lane-centerline` | Centerline paths (+ optional successor edges) |
| `adas-road-boundary` | Left / right curb paths |
| `adas-planning-path` | Ego plan trajectory (`cubicto`) |
| `adas-prediction` | Multi-modal prediction strokes (dash / alpha) |

`adas-sensor-fov` stays reserved (sector / frustum — not Path). Stop/crosswalk and drivable-area keep Group AABB stand-ins (optional closed+fill Path later).

### Non-goals (still out of scope)

- Replacing `GraphEdge.route: "shape"` with Path.
- FOV wedges, occupancy raster, rotate handles.
- Path as group member / SubNetwork remapping (root-document / active-document paths only in v1).
- topo-diagram skill dialect teaching Path (engine first; skill follow-up).
- Path arrows, flow animation, edge-style bundles.

## Alternatives considered

- **Special Node `type: "path"`:** rejected — pollutes box-node model; ADAS lanes are not nodes.
- **Optional `GraphEdge.from` / `to`:** rejected — breaks edge invariants and invites fake topology.
- **Protocol + paint only (no create/vertex UX):** rejected — product chose full interaction (方案 2).
- **lineto-only v1:** rejected — product required `quadto` / `cubicto` and `closed` in the same wave.
- **Fake lanes with invisible endpoint nodes:** rejected earlier; Path exists to end that pattern.

## Consequences

- Authors model freestanding geometry without fake endpoint nodes; ADAS lane / boundary / planning / prediction demos load as Path documents; Elements catalog has a `path` showcase (`lineto` / `quadto` / `cubicto` / closed / locked).
- Unique-id checks span four element kinds; collisions fail loud at parse / apply.
- Quad/cubic densify hit-testing remains approximate (same class as edge ShapeLink).
- Paint order mistakes can hide lanes under fills or cover nodes — under-node ordering is pinned in ViewSet / Network.
- Create Path uses exclusive mode packing so it does not fight pan/zoom or Create Link.
- Path vertex handles paint only while `MovePathVertexInteraction` is attached (Edit / `setEditing(true)`), not on Observe selection highlight.

## Testing

- `tests/graph-path.spec.ts` — protocol parse, patch/invert, densify, PathView, Network paint/hit/selection/commits.
- `tests/create-path.spec.ts` — CreatePath / vertex edit.
- `tests/delete-edge.spec.ts`, `tests/move-node.spec.ts` — path delete and body translate.
- `tests/demo-registry.spec.ts` — Elements `path` showcase; five ADAS Path samples loadable; only `adas-sensor-fov` reserved.

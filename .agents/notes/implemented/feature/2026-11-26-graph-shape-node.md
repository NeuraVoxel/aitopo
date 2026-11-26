# Agent Note: GraphShapeNode (twaver ShapeNode-inspired polygon)

Status: implemented

## Problem

ADAS and map diagrams need filled/open polygons that behave like **nodes** (group membership, alarms, whole-element drag, vertex edit) rather than freestanding strokes. `GraphPath` covers endpoint-free polylines but is intentionally not a node. Rectangular `GraphNode` / `GraphGroup` AABB stand-ins misrepresent curb areas, slots, and free-space. twaver `ShapeNodeUI` paints a node body from control points + `shapenode.closed`; aitopo had no equivalent element.

## Decision

The document carries a first-class **`GraphShapeNode`** in a top-level `shapeNodes` array beside `nodes` / `edges` / `groups` / `paths` (model A). Omitted `shapeNodes` ≡ `[]`. Document `version` stays `1`. ShapeNodes reuse Path densify (`lineto` / `quadto` / `cubicto`). Default `closed: true` for polygon semantics (`closed !== false` at paint / create; omitted ≡ closed — opposite of Path).

### Protocol

```ts
shapeNodes?: GraphShapeNode[]   // omitted ≡ []

// PathShapeKind: 'lineto' | 'quadto' | 'cubicto'

interface GraphShapeNodeStyle {
  stroke?: string
  lineWidth?: number
  strokeDash?: readonly number[]
  fill?: string
  alpha?: number
  shapeKind?: PathShapeKind      // default lineto
  label?: GraphTextStyle
  select?: GraphChromeStyle
  hover?: GraphChromeStyle
}

interface GraphShapeNode {
  id: string
  points: readonly { readonly x: number; readonly y: number }[]
  closed?: boolean               // default true (polygon); false = open polyline body
  label?: string
  label2?: string
  tooltip?: string
  locked?: boolean
  groupId?: string               // Group membership (Path v1 lacks this)
  alarms?: Alarm[]
  style?: GraphShapeNodeStyle
  data?: Readonly<Record<string, unknown>>
}
```

**Invariants (fail loud at parse / apply):**

- `id` unique across node | edge | group | path | shapeNode.
- Point arity matches `shapeKind` (same rules as Path); `updateShapeNode` validates merged arity.
- No rectangular `x/y/w/h` body — bounds from densified points.

**v1 edge endpoints:** still **node or group only** — ShapeNode is not a valid edge from/to (avoids anchor geometry rewrite).

### Render / hit / selection

- `ShapeNodeView` densifies via shared `path-route` helpers (`buildPathPolyline`); closed fill when `fill` set; `closedEffective = shapeNode.closed !== false`.
- Paint order: document `layers` bottom → top; within each layer filled surfaces (filled ShapeNode / closed+fill Path) → stroke paths → groups → edges → stroke shapeNodes → nodes. Hit pick reverses that. See [graph-layer](2026-11-26-graph-layer.md).
- Select/hover from `style.select` / `style.hover`; control-point handles paint only while `MoveShapeNodeVertexInteraction` is attached (Edit / `setEditing(true)`), not on Observe selection alone.
- Labels at densified bounds center (v1); `label2` / alarm on attachment anchors subset.
- Unlocked: body drag translates all points; handle drag updates one control point.
- Group: `groupId` + `memberIds` dual bookkeeping; shapeNode ids participate in membership and expanded autofit (`listGroupShapeNodes`). Drag dirty for members: [shapenode member residual](../bug-fix/2026-11-26-shapenode-member-drag-residual.md).

### Patch / Network

| Op | Payload |
|---|---|
| `addShapeNode` | `{ shapeNode: GraphShapeNode }` |
| `updateShapeNode` | `{ id, patch }` (`points` whole replace when present) |
| `removeShapeNode` | `{ id }` |

`getShapeNodes()`, `commitShapeNodeCreate/Update/Remove`, events `shapeNodeCreated` / `Updated` / `Removed`, selection + `toJSON` / `toRootJSON`.

### Interactions + demo

| Interaction | Behavior |
|---|---|
| `CreateShapeNodeInteraction` | Click append points; Enter/dblclick commit (`closed: true` default); Esc cancel; closed preview |
| `MoveShapeNodeVertexInteraction` | Drag control handles → `updateShapeNode` |
| Body move / Delete | `MoveNodeInteraction` translates all points; `DeleteEdgeInteraction` removes selected shapeNodes |

Demo exclusive `'create-shape-node'` mode packs `DeleteEdgeInteraction` + `CreateShapeNodeInteraction`; Toolbar **Create ShapeNode**. Edit packs `MoveShapeNodeVertexInteraction` next to `MovePathVertexInteraction`. Elements sample `shape-node` (open / closed fill / quad / cubic / locked / in-group). Public exports: `GraphShapeNode`, `GraphShapeNodeStyle`, `CreateShapeNodeInteraction`, `MoveShapeNodeVertexInteraction`.

### Non-goals (still out of scope)

- ShapeNode as `GraphEdge` from/to endpoint (v1).
- Rectangular resize handles / rotate.
- Replacing `GraphPath` or `GraphNode` boxes.
- HTML ShapeNode; topo-diagram skill dialect this wave.
- Forcing ADAS stop/drivable samples to migrate (optional follow-up).

## Alternatives considered

- **Strengthen GraphPath only:** rejected — Path is not a node; no group/alarm node semantics.
- **`nodes[]` + `type: "shape"` (model B):** rejected — product chose explicit top-level `shapeNodes` (model A), symmetric with `paths`.
- **`GraphNode.style.shape: "polygon"` only:** rejected — conflates box node with point-cloud body; harder id/bounds story.
- **lineto-only / no create interaction:** rejected — product required full densify kinds + CreateShapeNode in the same wave.

## Consequences

- Authors model curb / slot / free-space polygons as real nodes (group membership, alarms, body drag, vertex edit) without fake box nodes or Path-as-node misuse.
- Five element kinds widen apply/id/hit surface — exhaustive switches must include `shapeNode` wherever hit kinds / patch ops live.
- Quad/cubic hit remains approximate (same class as Path/ShapeLink).
- Create ShapeNode vs Create Path UX packing stays exclusive to avoid gesture fights.
- Edge create still rejects shapeNode ids as endpoints.

## Testing

- `tests/graph-shape-node.spec.ts` — protocol parse, patch/invert, ShapeNodeView, Network paint/hit/selection/commits.
- `tests/create-shape-node.spec.ts` — CreateShapeNode / vertex edit / body move / delete.
- `tests/demo-registry.spec.ts` — Elements `shape-node` showcase + group membership.

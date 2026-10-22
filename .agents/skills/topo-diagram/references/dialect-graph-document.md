# GraphDocument dialect (topo track)

Authority for shapes: `@neuravoxel/aitopo` protocol (`version: 1`). This file is the **authoring** contract for agents.

## Label principle (Node · Group · SubNetwork)

| Host | Title (`label`) | Subtitle (`label2`) |
|---|---|---|
| **Node** / SubNetwork member | Centered in body | Centered under title (fixed gap) |
| **Group** | Inside top of band | Centered under title (fixed gap) |

Primary `label` is **bold** by default (`style.label.fontWeight`, omit → bold). Engine defaults: nodes `labelPosition: "center"`; groups `labelPosition: "insideTop"`; both `label2Position: "insideBottom"` (resolved as under-title stack). Group auto-fit adds **extra top padding** so insideTop titles clear member nodes (`style.padding` / `style.paddingTop`). Override anchors only when needed. Prefer `label` (~13px ink, bold) + optional `label2` (~9–10px muted); topo host hides node icons by default.

## Nodes

- Stable, readable `id`.
- Small `type` set: `component`, `actor`, `state`, `layer`, `portal`, …
- Business fields go in `data`, not new top-level keys.
- Portal drill-down: set `networkId` to a key in `document.networks`.
- Prefer node `h` ≥ 64 when both title and subtitle are set.

## Edges

- Draw an edge only when the relationship is not obvious from layout.
- `kind`: `flow` | `dep` | `parent` | `msg`.
- **穿透 / cross-group links:** `from` / `to` are **member node ids**, never the group id (unless the semantic endpoint is the collapsed group itself). Document ids do not change on collapse; the engine remaps anchors in view.

### Link routing principle (orthogonal first)

Keep links **横平竖直** (axis-aligned). Prefer the engine’s built-in orthogonal link routing — do not invent diagonal polylines, Bezier/SVG path hacks, or host-only routers.

| Preference | How |
|---|---|
| 1. Auto orthogonal | Omit `waypoints` (or `[]`) — aitopo auto-routes H/V between boxes |
| 2. Side pins | Set `fromAnchor` / `toAnchor` (`top` \| `bottom` \| `left` \| `right`) when the exit/enter side matters; engine still routes orthogonally |
| 3. Explicit bends | Add `waypoints` only as **axis-aligned elbows** (each segment horizontal or vertical) |

Unsupported needs (named `linkType`, bus/bundle routing, obstacle avoidance, freeform/curve links, etc.) are **aitopo requirements**: propose → implement in engine with clean-room reference to `twaver.vector` Link ideas → rebundle. See `SKILL.md` Global principle.

## Groups

- Scope = `groups[]` + `memberIds` + member `groupId`.
- Structure diagrams **must set `expanded: true`**. Engine default when omitted is **collapsed**.
- Do not nest groups (deferred in engine). Use SubNetwork or sibling groups instead.
- Title defaults to **inside top**; auto-fit top padding clears members (see Label principle).

## SubNetwork

- Single level: root ↔ one child via `networks[id]`.
- Child document is a full `GraphDocument` (`version: 1`, nodes, edges, …) and inherits the same label principle.

## Layout

- Prefer explicit `x` / `y`.
- Else host may call `network.layout('grid' | 'flowColumns')` after load.
- Density ~4/10; prefer ≤9 focal nodes or split / drill down.

## meta.kind

Protocol allows only `topology` | `flow` | `custom`. Put the diagram-design type name in `meta.title` or `meta` extension fields the host ignores, not in `kind` unless it matches the enum.

## Style roles → Graph*Style

| Role | Node / group | Edge |
|---|---|---|
| default | `fill: #ffffff`, `stroke: #2d3142` | `stroke: #2d3142` |
| muted | `fill: #eef0f3`, `stroke: #6b7280` | `stroke: #6b7280` |
| focal / accent | `fill` or `stroke: #bf4520` (1–2 nodes) | `stroke: #bf4520` |
| group band | `fill: #eef0f3`, `stroke: #2d3142` | — |

Do not emit arbitrary hex outside this table unless the project style-guide was customized.

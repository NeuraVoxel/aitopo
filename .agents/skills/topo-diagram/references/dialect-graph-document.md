# GraphDocument dialect (topo track)

Authority for shapes: `@neuravoxel/aitopo` protocol (`version: 1`). This file is the **authoring** contract for agents.

Engine defaults stay demo-stable. **Skill look is opt-in via style fields** on each element (or shared patterns copied into emitted JSON). See `SKILL.md` Global principle.

## Label principle (skill authoring)

Set these styles explicitly on authored nodes/groups (including SubNetwork members):

| Host | Title (`label`) | Subtitle (`label2`) | Extra |
|---|---|---|---|
| **Node** | `labelPosition: "center"`, `label.fontWeight: "bold"`, `label.color: "#000000"` | `label2Position: "insideBottom"`, `label2.color: "#6b7280"` | Prefer `h` ≥ 64 when both lines set; host uses `showNodeIcons: false` |
| **Group** | `labelPosition: "insideTop"`, `label.fontWeight: "bold"`, `label.color: "#000000"` | `label2Position: "insideBottom"` | Set `paddingTop` (e.g. ~32–40) so the title clears members; `padding` for other sides |

When `labelPosition` is `center` / `insideTop*` and `label2Position` is `insideBottom`, the engine stacks the subtitle under the title with a fixed gap. Prefer `label` ~13px black + optional `label2` ~9–10px muted.

### Node chrome (skill default — required)

Engine node body reads **`data.fill` / `data.stroke`**, not `style.fill`. Omitting them falls through to near-black demo chrome (`#1a1d24`) with light gray icons — unreadable on light paper. **Every skill node** (including SubNetwork members) must set white fill + dark stroke + black title:

```json
"data": { "fill": "#ffffff", "stroke": "#2d3142" },
"style": {
  "labelPosition": "center",
  "label": { "fontSize": 13, "fontWeight": "bold", "color": "#000000" },
  "showIcon": false
}
```

Muted / focal roles swap fill or stroke per the Style roles table below. Never emit a node that relies on engine body defaults.

### Third title (Alarm tag, skill styles)

Use the protocol **Alarm** field — not a fourth label key. Engine default stays a severity `dot` at `topRight`. Skill architecture cards set an outline pill in the upper-left:

```json
"alarms": [{ "id": "code", "level": "info", "message": "APP" }],
"style": {
  "alarmPosition": "insideTopLeft",
  "alarmVariant": "tag",
  "alarm": { "color": "#2d3142", "fontSize": 7, "maxChars": 5 }
}
```

| Field | Skill value |
|---|---|
| `alarms[].message` | Short code (VEH / APP / LAKE / QUERY …), ≤5 chars unless `maxChars` raised |
| `alarmPosition` | `insideTopLeft` |
| `alarmVariant` | `tag` |
| `alarm.color` | Match node stroke / accent ink |

Do not invent host-drawn badges; missing Alarm chrome → aitopo requirement.

Optional dashed body outline (e.g. security / optional nodes): `style.strokeDash: [4, 4]` (solid when omitted).

## Nodes

- Stable, readable `id`.
- Small `type` set: `component`, `actor`, `state`, `layer`, `portal`, …
- Business fields go in `data`, not new top-level keys.
- Portal drill-down: set `networkId` to a key in `document.networks`.

## Edges

- Draw an edge only when the relationship is **not** obvious from adjacency on the grid.
- `kind`: `flow` | `dep` | `parent` | `msg`.
- **穿透 / cross-group links:** `from` / `to` are **member node ids**, never the group id (unless the semantic endpoint is the collapsed group itself). Document ids do not change on collapse; the engine remaps anchors in view.

### Link routing principle (orthogonal first · keep sparse)

**Default** links stay **横平竖直**. Prefer orthogonal auto-routing; do not invent host-only Bezier/SVG path hacks. Opt-in `style.route` covers ring arcs and radial spokes.

| Preference | How |
|---|---|
| 1. Auto orthogonal | Omit `waypoints` (or `[]`) and omit `style.route` (or `"orthogonal"`) — aitopo auto-routes H/V between boxes |
| 2. Side pins | Set `fromAnchor` / `toAnchor` **only** when the exit/enter side carries meaning (or to keep a feedback edge on the open side of a U). Same-row / same-column neighbors usually omit anchors. |
| 3. Explicit bends | Add `waypoints` as **axis-aligned elbows** only when auto-route crosses a box; prefer moving nodes onto the grid instead |
| 4. Ring arcs | `style.route: "arc"` + required `style.arcCenter` + preferred shared `arcRadius` (optional `arcClockwise`, default `true`). Endpoints project onto the circle; paint uses a true canvas arc. |
| 5. Radial spokes | `style.route: "straight"` + `fromAnchor`/`toAnchor: "radial"` (center→peer ray hits each box). Optional `toOutset` / `fromOutset` (px) nudge the port outward — lake hubs often use `toOutset: 6`. |

**Sparsity (skill default):**

- One **primary path** per story; feedback / writeback as **one** dashed `dep` edge, not a fan of parallels.
- Many→one: insert a merge node, or align sources so edges stay parallel — do not spider-web every pair.
- Labels only on non-obvious edges (hand-off, feedback, writeback). Chain steps on a row need no label.
- Prefer deleting a crossing edge over adding waypoints.

### Link label principle (skill styles)

Engine default keeps demo-stable `pathLeft` offset. Skill edges set:

```json
"style": { "labelSide": "aboveOrRight" }
```

| Segment at `labelAt` | Label placement |
|---|---|
| Horizontal | Above the stroke |
| Vertical | To the right of the stroke |

Optional: tune `labelAt` / `label2At` (arc-length ratio), `labelGap` (world px from stroke to label center; default `8`), and `style.label` text color/size. Do not invent host-side label drawing.

Unsupported needs (bus/bundle routing, obstacle avoidance, freeform multi-control Beziers, etc.) remain **aitopo requirements**: propose → implement → rebundle. Circular ring arcs and straight spokes ship as `style.route` ([edge route arc](../../../notes/implemented/feature/2026-10-22-edge-route-arc.md)).

## Groups

- Scope = `groups[]` + `memberIds` + member `groupId`.
- Structure diagrams that should open immediately set `expanded: true`. Engine default when omitted is **collapsed** (e.g. 应用层 starts collapsed; host **double-click** toggles).
- **Nested groups:** child sets `parentId` to the parent group id; parent `memberIds` lists the child group id alongside node ids (dual bookkeeping). Prefer ≤1 nesting level (e.g. 应用平台 → 应用层). Cycles fail at parse. Deeper trees → keep flat or use SubNetwork.
- Apply Group row of the Label principle (insideTop + `paddingTop`). Collapsed card chrome that mirrors a node: `showIcon: false` plus optional Alarm `tag`.
- **Collapsed fill/stroke:** set `style.fill` / `style.stroke` (lake-band tokens, e.g. `rgba(45,49,66,0.03)` / `rgba(45,49,66,0.12)`). Engine defaults collapsed chrome to near-black node body when both `style` and `data` omit fill — do not rely on `data.fill` alone for light architecture cards (engine also falls back to `data.fill`/`data.stroke` when present).
- **Collapse geometry:** host toggle snapshots the painted band into `x/y/w/h` so the frame does not shrink to a 50×50 chip; expand recenters members if the collapsed frame was moved.
- Cross-boundary edges attach to **member** node ids (穿透 remaps to the **nearest collapsed ancestor**).

## SubNetwork

- Stack: root ↔ child ↔ grandchild … via each document's own `networks[id]` (double-click enter, empty double-click pops one level).
- Child document is a full `GraphDocument` (`version: 1`, nodes, edges, nested `networks`, …); apply the same Node label styles inside.
- Prefer shallow stacks (≤2–3); cycle ids along the path fail loud.

## Layout (grid first · 简洁规整)

Skill default is a **regular orthogonal grid**, not freeform scatter.

| Rule | Practice |
|---|---|
| Pitch | Pick fixed column / row steps (e.g. `dx ≈ 200`, `dy ≈ 140–160`) and stick to them on one canvas |
| Align | Same row → shared `y`; same column → shared `x`. Neighbors that share an edge should share a row **or** a column so auto-route stays a single H/V segment |
| Reading order | Left → right for forward flow; top → bottom for stages; U-turns fold on the grid (top row L→R, bottom row R→L) |
| Groups | Place the band so members already sit on the grid; leave ≥1 pitch gutter between bands |
| Density | ~4/10; prefer ≤9 root nodes — extra detail → SubNetwork portal, not more root edges |
| Coordinates | Prefer explicit `x` / `y`. Else host may call `network.layout('grid' \| 'flowColumns')` after load |

**Stop** when removing one more edge or aligning one more node would not improve scanability.

## meta.kind

Protocol allows only `topology` | `flow` | `custom`. Put the diagram-design type name in `meta.title` or `meta` extension fields the host ignores, not in `kind` unless it matches the enum.

## Style roles → Graph*Style

| Role | Node (`data.*` + label) | Group (`style.*`) | Edge |
|---|---|---|---|
| default | `data.fill: #ffffff`, `data.stroke: #2d3142`, `label.color: #000000` | `fill: #eef0f3`, `stroke: #2d3142`, `label.color: #000000` | `stroke: #2d3142` |
| muted | `data.fill: #eef0f3`, `data.stroke: #6b7280`, `label.color: #000000` | — | `stroke: #6b7280` |
| focal / accent | `data.fill` or `data.stroke: #bf4520` (1–2 nodes); keep black label on light fill | — | `stroke: #bf4520` |
| group band | — | `fill: #eef0f3`, `stroke: #2d3142` | — |

Do not emit arbitrary hex outside this table unless the project style-guide was customized. Map skill label/layout look through the Label principle table, not by changing engine defaults.

# GraphDocument dialect (topo track)

Authority for shapes: `@neuravoxel/aitopo` protocol (`version: 1`). This file is the **authoring** contract for agents.

Engine defaults stay demo-stable. **Skill look is opt-in via style fields** on each element (or shared patterns copied into emitted JSON). See `SKILL.md` Global principle.

## Label principle (skill authoring)

Set these styles explicitly on authored nodes/groups (including SubNetwork members):

| Host | Title (`label`) | Subtitle (`label2`) | Extra |
|---|---|---|---|
| **Node** | `labelPosition: "center"`, `label.fontWeight: "bold"` | `label2Position: "insideBottom"` | Prefer `h` ≥ 64 when both lines set; host uses `showNodeIcons: false` |
| **Group** | `labelPosition: "insideTop"`, `label.fontWeight: "bold"` | `label2Position: "insideBottom"` | Set `paddingTop` (e.g. ~32–40) so the title clears members; `padding` for other sides |

When `labelPosition` is `center` / `insideTop*` and `label2Position` is `insideBottom`, the engine stacks the subtitle under the title with a fixed gap. Prefer `label` ~13px ink + optional `label2` ~9–10px muted.

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

- Draw an edge only when the relationship is not obvious from layout.
- `kind`: `flow` | `dep` | `parent` | `msg`.
- **穿透 / cross-group links:** `from` / `to` are **member node ids**, never the group id (unless the semantic endpoint is the collapsed group itself). Document ids do not change on collapse; the engine remaps anchors in view.

### Link routing principle (orthogonal first)

Keep links **横平竖直** (axis-aligned). Prefer the engine’s built-in orthogonal link routing — do not invent diagonal polylines, Bezier/SVG path hacks, or host-only routers. Every segment of auto routes, elbows, and “special” polylines must be horizontal or vertical.

| Preference | How |
|---|---|
| 1. Auto orthogonal | Omit `waypoints` (or `[]`) — aitopo auto-routes H/V between boxes |
| 2. Side pins | Set `fromAnchor` / `toAnchor` (`top` \| `bottom` \| `left` \| `right`) when the exit/enter side matters; engine still routes orthogonally |
| 3. Explicit bends | Add `waypoints` only as **axis-aligned elbows** (each segment shares x **or** y with its neighbors — never both differ) |

### Link label principle (skill styles)

Engine default keeps demo-stable `pathLeft` offset. Skill edges set:

```json
"style": { "labelSide": "aboveOrRight" }
```

| Segment at `labelAt` | Label placement |
|---|---|
| Horizontal | Above the stroke |
| Vertical | To the right of the stroke |

Optional: tune `labelAt` / `label2At` (arc-length ratio) and `style.label` text color/size. Do not invent host-side label drawing.

Unsupported needs (named `linkType`, bus/bundle routing, obstacle avoidance, freeform/curve links, etc.) are **aitopo requirements**: propose → implement in engine with clean-room reference to `twaver.vector` Link ideas → rebundle.

## Groups

- Scope = `groups[]` + `memberIds` + member `groupId`.
- Structure diagrams **must set `expanded: true`**. Engine default when omitted is **collapsed**.
- Do not nest groups (deferred in engine). Use SubNetwork or sibling groups instead.
- Apply Group row of the Label principle (insideTop + `paddingTop`).

## SubNetwork

- Single level: root ↔ one child via `networks[id]`.
- Child document is a full `GraphDocument` (`version: 1`, nodes, edges, …); apply the same Node label styles inside.

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

Do not emit arbitrary hex outside this table unless the project style-guide was customized. Map skill label/layout look through the Label principle table, not by changing engine defaults.

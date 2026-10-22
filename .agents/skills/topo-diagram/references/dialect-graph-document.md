# GraphDocument dialect (topo track)

Authority for shapes: `@neuravoxel/aitopo` protocol (`version: 1`). This file is the **authoring** contract for agents.

## Label principle (Node · Group · SubNetwork)

**Title centered; subtitle centered under the title.** Engine defaults: `labelPosition: "center"`, `label2Position: "insideBottom"`. Subtitle uses a fixed gap under the title (independent of body height). Applies to every Node and Group, including elements inside a SubNetwork document. Override only when a diagram truly needs another anchor. Prefer `label` (~13px ink) + optional `label2` (~9–10px muted); topo host hides node icons by default so they do not cover the title.

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

## Groups

- Scope = `groups[]` + `memberIds` + member `groupId`.
- Structure diagrams **must set `expanded: true`**. Engine default when omitted is **collapsed**.
- Do not nest groups (deferred in engine). Use SubNetwork or sibling groups instead.
- Same title/subtitle principle as nodes (see above).

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

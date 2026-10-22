# Type routing

Pick a semantic pattern (optional), then a visual type, then a **track**.

Prefer **topo** when meaning depends on **containment**, **cross-boundary links**, or **drill-down**.

## topo

Emit `diagram.graph.json` + host HTML (`assets/host/` template). Use Groups, member-anchored cross edges, and optional SubNetwork portals.

| Type | Notes |
|---|---|
| Architecture | Primary |
| Architecture delta | Two docs or before/after groups; keep Changes in prose/meta |
| Nested / tree / org | Groups (`parentId` nesting ≤1 preferred) or `parent` edges |
| Dependency graph | `kind: dep` |
| Data flow / flowchart | `kind: flow` |
| Swimlane | One Group per lane |
| Deployment / IT current-state | Groups + portals for environments |
| Sequence | Weak: actors as nodes/lanes, ordered `kind: msg` edges |
| State machine | Nodes = states, edges = transitions |
| Loop / flywheel (with SubNetwork drill-down or live edit) | Ring nodes + `style.route: "arc"` / `"straight"`; see dialect |

## svg

Self-contained HTML/SVG using style-guide CSS variables. See `assets/svg/quadrant.example.html` as a minimal pattern.

| Type |
|---|
| Radar / spider, polar |
| Heatmap, bar / dumbbell, waterfall |
| Gantt, scatter / bubble / beeswarm |
| Venn, quadrant, pyramid / funnel, treemap / marimekko |
| Pure timeline (no topology) |
| Loop / flywheel (static print only, no drill-down) |

## defer

Refuse in one short sentence; point to `diagram-design` or a topo/svg substitute.

| Type | Fallback hint |
|---|---|
| Exploded axonometric / axonometric plan | architecture (topo) or diagram-design |
| Rich Wardley | diagram-design |
| Sankey / fishbone (dense) | data flow (topo) if sparse; else diagram-design |
| Full UML class with attributes | ER/table prose or diagram-design |
| Story map / kanban boards | diagram-design |

When unsure: if the reader must **collapse a scope and keep cross links**, choose topo; if the reader must **compare magnitudes on axes**, choose svg.

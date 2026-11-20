# Semantic patterns (topo-relevant)

Choose at most one primary pattern, then a visual type from `routing.md`.

| Trigger | Pattern | Prefer |
|---|---|---|
| Nested admin vs traffic / trust scopes | Nested scope | Architecture + Groups |
| Fan-in, bottleneck, hand-off across bands | Cross-boundary flow | Data flow / swimlane; member-anchored edges; see `flowchart-fan-in.json`, `flowchart-swimlane.json`, `data-flow-pipeline.json` |
| Detail behind a portal | Drill-down | SubNetwork + `portal` node |
| Structural before/after | Topology delta | Two docs or paired groups + prose Changes |
| Hierarchy by ownership | Tree / parent links | `kind: parent` and/or Groups |

If no pattern fits, pick the type from `routing.md` directly.

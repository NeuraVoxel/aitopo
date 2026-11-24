# Layout recipes (topo GraphDocument)

Product-level authoring borrowed from `vendor/diagram-design` (budgets, connector discipline, type recipes) and `vendor/archify` (parameter → coordinate, then validate). Engine paint/routing still follows aitopo / twaver clean-room rules in `dialect-graph-document.md`.

Load this file when the diagram is a **flowchart, data-flow, swimlane, state machine, or feedback loop**. Pair with [`layout-verify.md`](layout-verify.md) before emit.

## Shared grid (4px family)

| Token | Value |
|---|---|
| `NODE_W` / `NODE_H` | `120` / `56` (title-only); `120` / `64` with `label2` |
| `dx` / `dy` | `200` / `120` |
| Decision branch offset | `dx` to the right of the main column |
| Max nodes (root) | **9** |
| Max edges | **12** |
| Max coral / focal | **2** nodes or edges |

Origin: prefer `x0 = 80`, `y0 = 40`. All `x`/`y`/`w`/`h` divisible by 4.

```
x(col) = x0 + col * dx
y(row) = y0 + row * dy
```

Same row → same `y`; same column → same `x`. Neighbors that share an edge must share a row **or** a column so auto-orthogonal stays a single segment.

## Connector rules (GraphDocument)

Adapted from diagram-design §6; expressed in aitopo fields:

1. **Orthogonal only** — omit `style.route` (or `"orthogonal"`). No diagonal intent; do not invent host Beziers.
2. **Engine params before waypoints** — auto-route → `fromAnchor`/`toAnchor` → `style.route` (`arc` / `straight`+`radial`) / outset → restructure grid. Add axis-aligned `waypoints` **only** when those still cannot avoid a box cross (see dialect Link routing).
3. **Sparse** — one primary path; feedback / return = **one** dashed `kind: "dep"` with `style.strokeDash: [5, 4]`.
4. **No spider-web** — many→one uses a merge node (small step) or parallel aligned sources, not N edges into one corner.
5. **Labels** — only on non-obvious edges; `style.labelSide: "aboveOrRight"`; ≤14 chars preferred.
6. **Anchors** — set `fromAnchor` / `toAnchor` when the port carries meaning (Yes→`right`, No→`bottom`, feedback→open side of a U). Stagger same-side leaves with corners (`bottomRight` etc.).

## Skill node chrome (copy into every example)

```json
"w": 120, "h": 56,
"data": { "fill": "#ffffff", "stroke": "#2d3142" },
"style": {
  "labelPosition": "center",
  "label": { "fontSize": 13, "fontWeight": "bold", "color": "#000000" },
  "showIcon": false
}
```

Decision nodes: same chrome; use `type: "decision"` and diamond-like reading via short label (`Valid?`). Merge: `type: "merge"`, label `·` or `Join`, muted fill `#eef0f3`.

## Recipe catalog

Golden JSON under [`assets/examples/`](../assets/examples/README.md).

| Recipe | File | Layout |
|---|---|---|
| Linear process | `flowchart-linear.json` | Single column, top→down |
| Decision tree | `flowchart-decision.json` | Main column + Yes right / No down; merge rejoins |
| Feedback loop | `flowchart-feedback.json` | U on grid; one dashed return |
| Swimlane handoff | `flowchart-swimlane.json` | One Group per lane; cross-lane edges on members |
| Data pipeline | `data-flow-pipeline.json` | Rows = roles, cols = stages; sparse cross-role edges |
| State machine | `state-machine.json` | States on a row/ring; labeled transitions only |
| Fan-in merge | `flowchart-fan-in.json` | Three sources → merge → sink |

### Linear (parameter → coords)

```
steps[0..n-1]
node i: { x: x0 + dx, y: y0 + i * dy }   // single column col=1
edge i → i+1: kind flow, no label
```

### Decision (Yes right / No down)

```
row0 Start
row1 Decision          // col=1
row1 Yes action        // col=2  (fromAnchor right → toAnchor left)
row2 No action         // col=1  (fromAnchor bottom → toAnchor top)
row3 Merge             // col=1; Yes also edges into merge (toAnchor right or top)
row4 End
```

Label Yes/No on the two exits. Coral on happy path **or** the consequential decision — not both everywhere.

### Swimlane

```
lanes[0..L-1] as groups, expanded: true, paddingTop: 40, padding: 28
lane i chrome top ≈ y0 + i * (lanePitch)
lanePitch ≥ NODE_H + paddingTop + padding + 100   // chrome gutter
steps inside a lane share the lane's member y-band
cross-lane edge: from/to member ids; prefer shared column (vertical segment)
```

### Data pipeline

```
lanes = roles (rows), steps = stages (cols)
node at (laneKey, stepIndex): x = x0 + stepIndex * dx, y = y0 + laneIndex * dy
arrows only for real hand-offs; muted within lane; accent for one cross-role focal hop
```

## Anti-patterns (automatic fail)

- Diagonal or freeform scatter coordinates
- Decision with 4+ unlabeled exits
- Every hop labeled
- Parallel edges stacked on the same attach side without column offset
- Group spacing from member `y` only (ignore `paddingTop` chrome) — see dialect Group stacking
- Calling `network.layout('grid')` to “fix” a bad story instead of rewriting topology

## After emit

Run the checklist in [`layout-verify.md`](layout-verify.md). Prefer restructuring (direction, merge node, drop edge) over nudging a single `x` by a few pixels.

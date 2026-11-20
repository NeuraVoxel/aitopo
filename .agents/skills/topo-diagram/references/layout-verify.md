# Layout verify (pre-emit)

Run mentally or as a punch-list after drafting `diagram.graph.json`. Inspired by diagram-design §9 and archify validate/repair — **no** SVG verifier in this skill yet; failures are fixed by rewriting the GraphDocument.

## Topology budget

- [ ] Root nodes ≤ 9; edges ≤ 12
- [ ] ≤ 2 focal/coral nodes or edges
- [ ] One primary path; at most one dashed feedback/`dep` return

## Grid & alignment

- [ ] Every `x`/`y`/`w`/`h` divisible by 4
- [ ] Shared row → identical `y`; shared column → identical `x`
- [ ] Every edge’s endpoints share a row **or** a column (or have explicit orthogonal `waypoints`)
- [ ] Pitch matches recipe (`dx≈200`, `dy≈120`) unless a typed recipe says otherwise

## Connectors

- [ ] No diagonal intent; `style.route` omitted or `"orthogonal"` (except documented arc/radial)
- [ ] `waypoints` only axis-aligned; prefer moving nodes over elbows
- [ ] Cross-group edges use **member** ids
- [ ] Labels only on non-obvious edges; `labelSide: "aboveOrRight"`
- [ ] Anchors only when side meaning matters

## Groups (if any)

- [ ] Chrome boxes (members ± `paddingTop`/`padding`) do not intersect; gutter ≥ 80–100px
- [ ] Structure diagrams that should open set `expanded: true`

## Chrome

- [ ] Every node sets `data.fill` / `data.stroke` (skill white/dark — never engine default body)
- [ ] Node titles: `labelPosition: "center"`, bold black; `showIcon: false`

## Stop rule

- [ ] Removing one more edge or aligning one more node would not improve scanability

If any box fails: **restructure** (change flow direction, add merge, drop edge, split overview/detail via SubNetwork). Do not ship with “explain the mess” prose.

# Agent Note: topo-diagram layout recipes and flowchart goldens

Status: implemented

## Problem

topo-diagram already asked for a grid and orthogonal links, but agents still freestyled coordinates, so flowcharts looked messy. Product references in `vendor/diagram-design` and `vendor/archify` encode tighter budgets, connector rules, and parameter→coordinate recipes that were not wired into the skill.

## Decision

Skill-side only (no engine import of the vendor trees):

1. [`layout-recipes.md`](../../../skills/topo-diagram/references/layout-recipes.md) — shared grid, six connector rules as GraphDocument fields, typed recipes.
2. [`layout-verify.md`](../../../skills/topo-diagram/references/layout-verify.md) — pre-emit checklist.
3. Golden documents under [`assets/examples/`](../../../skills/topo-diagram/assets/examples/README.md): linear, decision, feedback, swimlane, fan-in, data-flow pipeline, state machine.
4. `SKILL.md` / `routing.md` / `dialect-graph-document.md` route flow types through recipes + verify.

Engine paint/routing remains aitopo / twaver clean-room; vendor submodules stay ideas-only.

## Alternatives considered

- **Import archify/diagram-design renderers into aitopo:** rejected — wrong layer; product refs must not enter `src/`.
- **Rely on `network.layout('grid')` after messy JSON:** rejected — cannot fix bad topology or spider-webs.
- **SVG-only flowchart track:** rejected — topo already owns interactive flow; discipline belongs in GraphDocument authoring.

## Consequences

- Flowchart generation should copy or follow a golden recipe, then pass layout-verify.
- New flow types add a recipe row + example JSON in the same change.

## Testing

- `tests/topo-diagram-examples.spec.ts` — every `assets/examples/*.json` parses as a `GraphDocument`.
- Manual: serve `assets/`, open `host/index.html`, switch **Example** (or `?example=flowchart-decision`).

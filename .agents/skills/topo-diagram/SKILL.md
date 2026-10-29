---
name: topo-diagram
description: Create architecture and structure diagrams with Group collapse, cross-boundary link remapping, and SubNetwork drill-down via a vendored aitopo Canvas engine; fall back to SVG/HTML for statistical or geometric chart types. Use when the user wants topology-aware diagrams, penetration across groups, interactive browse/edit pages, or diagram-design-like coverage backed by GraphDocument.
metadata:
  version: "0.1.0"
  aitopo: "0.1.0"
---

# Topo Diagram

Dual-track diagram skill: **topo** (Canvas + `GraphDocument` + bundled `aitopo.iife.js`) and **svg** (self-contained HTML). Prefer topo when containment, cross-group links, or drill-down carry the meaning.

## Global principle (skill vs aitopo)

**Prefer keeping aitopo source and demo behavior unchanged.** Skill look-and-feel is applied by **authoring parameters the engine already supports** (`Graph*Style`, anchors, waypoints, host options) in dialect, host template, and emitted `diagram.graph.json`.

| Situation | Action |
|---|---|
| Desired look fits existing protocol / `Network` options | Set those params in the skill (dialect + sample + generated docs / host). Do **not** change engine defaults. |
| Need a capability aitopo does not support | Raise an **aitopo requirement** (`.agents/notes/proposed/` when non-trivial) → implement in aitopo with clean-room **`twaver.vector`** reference (see repo `AGENTS.md`) → `pnpm run bundle:topo-diagram-skill` → then teach it in the skill. |
| Never | Hand-edit `assets/aitopo.iife.js`; invent dialect the engine cannot honor; change global engine defaults only to style this skill. |

SVG-track and explicit **defer** remain valid for statistical/geometric or out-of-scope asks.

## Workflow

1. **Style gate** — On the first diagram in a project, follow [`references/style-guide.md`](references/style-guide.md).
2. **Pattern (optional)** — [`references/semantic-patterns.md`](references/semantic-patterns.md).
3. **Route** — [`references/routing.md`](references/routing.md): `topo` | `svg` | `defer`.
4. **Author**
   - **topo:** follow [`references/dialect-graph-document.md`](references/dialect-graph-document.md); emit **only** `diagram.graph.json` + `diagram.html` per [`references/host.md`](references/host.md). Point script tags at the **shared** skill `assets/` (use `scripts/runtime-href.mjs`); do **not** copy `aitopo.iife.js` / `host.js` into the diagram folder.
   - **svg:** self-contained HTML using style-guide CSS variables; see `assets/svg/quadrant.example.html`.
   - **defer:** one-sentence refusal + fallback name.
5. **Stop** when nothing else can be removed (density ~4/10).

## Topo non-negotiables

- **Labels + chrome (skill styles, not engine defaults):** Node title `center` + bold + `color: "#000000"`; every node sets `data.fill: "#ffffff"` + `data.stroke: "#2d3142"` (engine body reads `data.*`, not `style.fill` — omit → near-black). Group title when expanded `insideTop` + bold + `paddingTop` + black label; collapsed title uses engine default `bottom` (override with `collapsedLabelPosition`); subtitle `insideBottom` under the title; third title via **Alarm** `tag` at `insideTopLeft` (see dialect).
- **Layout + links (简洁规整):** place nodes on a fixed `dx`/`dy` grid (same row → same `y`); primary path only; feedback = one dashed edge. 横平竖直 — prefer auto orthogonal; pin anchors only when side matters; avoid spider-webs and labeled every-hop. Edge text: `style.labelSide: "aboveOrRight"`. **Group gaps use chrome boxes** (`paddingTop`/`padding`), not member AABB alone — see dialect Layout → Group stacking. Missing capability → aitopo requirement.
- Structure diagrams that should open immediately set Group `expanded: true` (engine default is collapsed; host **double-click** toggles). Collapsed card chrome: `showIcon: false` when mirroring a node.
- Cross-group edges attach to **member** ids (穿透 = view remapping on collapse).
- Nested groups allowed (`parentId` + child id in parent `memberIds`); prefer ≤1 nesting level. SubNetwork supports a stack (root → child → …); prefer shallow depth.
- Stock host **default** = pan/zoom + drag-move (basic). ⋯ → **Fullscreen** (page), **Edit mode** (bend / resize / Alt+drag create / Delete edge). Copy/Download JSON use `toRootJSON()` (full live document). ⋯ also exports Excalidraw / draw.io / PNG / SVG via `assets/host/export-diagram.js`.
- Host may only use pinned `Aitopo` symbols listed in `references/host.md`.
- Rebuild the bundle from the aitopo repo: `pnpm run bundle:topo-diagram-skill` — never hand-edit `assets/aitopo.iife.js`. Downstream pages share that asset tree; rebundling updates all diagrams that link to it.

## When not to use

- Attribute-only tables, one-sentence ideas, or unicode sketches.
- Types listed under **defer** in `routing.md` when no honest topo/svg substitute exists.

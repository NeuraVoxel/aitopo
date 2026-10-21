---
name: topo-diagram
description: Create architecture and structure diagrams with Group collapse, cross-boundary link remapping, and SubNetwork drill-down via a vendored aitopo Canvas engine; fall back to SVG/HTML for statistical or geometric chart types. Use when the user wants topology-aware diagrams, penetration across groups, interactive browse/edit pages, or diagram-design-like coverage backed by GraphDocument.
metadata:
  version: "0.1.0"
  aitopo: "0.1.0"
---

# Topo Diagram

Dual-track diagram skill: **topo** (Canvas + `GraphDocument` + bundled `aitopo.iife.js`) and **svg** (self-contained HTML). Prefer topo when containment, cross-group links, or drill-down carry the meaning.

## Workflow

1. **Style gate** — On the first diagram in a project, follow [`references/style-guide.md`](references/style-guide.md).
2. **Pattern (optional)** — [`references/semantic-patterns.md`](references/semantic-patterns.md).
3. **Route** — [`references/routing.md`](references/routing.md): `topo` | `svg` | `defer`.
4. **Author**
   - **topo:** follow [`references/dialect-graph-document.md`](references/dialect-graph-document.md); emit JSON + HTML per [`references/host.md`](references/host.md). Start from `assets/host/`.
   - **svg:** self-contained HTML using style-guide CSS variables; see `assets/svg/quadrant.example.html`.
   - **defer:** one-sentence refusal + fallback name.
5. **Stop** when nothing else can be removed (density ~4/10).

## Topo non-negotiables

- Structure diagrams set Group `expanded: true` (engine default is collapsed).
- Cross-group edges attach to **member** ids (穿透 = view remapping on collapse).
- SubNetwork is single-level only; no nested groups.
- Create edge in the stock host: **Alt+drag**.
- Host may only use pinned `Aitopo` symbols listed in `references/host.md`.
- Rebuild the bundle from the aitopo repo: `pnpm run bundle:topo-diagram-skill` — never hand-edit `assets/aitopo.iife.js`.

## When not to use

- Attribute-only tables, one-sentence ideas, or unicode sketches.
- Types listed under **defer** in `routing.md` when no honest topo/svg substitute exists.

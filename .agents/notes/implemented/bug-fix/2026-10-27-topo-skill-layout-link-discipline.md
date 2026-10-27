# Agent Note: Topo-diagram skill defaults to sparse grid layout and links

Status: implemented

## Problem

Skill-authored diagrams often scattered nodes off-grid and over-connected them (spider-webs, every-hop labels, many parallel feedback edges). Orthogonal auto-route then drew busy Z-shapes that were hard to scan.

## Decision

Skill authoring defaults favor **简洁规整**:

- **Layout:** fixed `dx` / `dy` grid; same row → shared `y`; same column → shared `x`; neighbors that share an edge share a row or column; density ~4/10 with SubNetwork for detail.
- **Links:** one primary path; feedback / writeback as sparse dashed `dep` edges; pin `fromAnchor` / `toAnchor` only when side matters; prefer moving nodes over adding `waypoints`; labels only on non-obvious hops.
- Documented in `dialect-graph-document.md` (Layout + Link routing sparsity) and `SKILL.md` non-negotiables. Engine demo defaults unchanged.

## Alternatives considered

**Change engine auto-route heuristics.** Rejected: skill global principle keeps aitopo defaults stable; cleanliness is an authoring contract.

**Keep dense “complete” relationship graphs.** Rejected: architecture / loop diagrams scan worse; extra pairs belong in SubNetwork or prose.

## Consequences

New skill diagrams should read as aligned H/V chains. Existing diagrams stay as authored until re-laid on the grid.

## Testing

`ai-eng verify-notes .agents/notes`. Spot-check a rebuilt host page: primary path is a single U or row; at most a few dashed feedback edges.

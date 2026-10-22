# Agent Note: GraphEdge attachments aligned with twaver.Link / GraphNode

Status: implemented

## Problem

`GraphEdge` carried topology (`from`/`to`, `kind`, `waypoints`) and protocol `alarms`, but paint read ad-hoc `data.stroke` / `data.label` / `data.lineWidth` / `data.strokeDash` / `data.strokeHover`. There was no typed `style`, no `label`/`label2`/`tooltip` fields, no Attachment instances under `EdgeView`, no whole-edge `alpha`, no arrows, and alarms were never drawn. [GraphNode attachments](./2026-09-11-graph-node-attachments.md) already established protocol approach A (structured fields + View-owned attachments) and dual bounds; edges stayed on the pre-attachment model while create/delete/bend editing was done ([Wave I](./2026-09-11-wave-i-move-edge-bend.md)).

## Decision

GraphEdge mirrors GraphNode’s model for link visuals: typed content + `GraphEdgeStyle`, lean Attachment subclasses on `EdgeView`, dual bounds, and a hard cut away from `data.*` paint keys (fixtures/demo migrated in the same change).

### Protocol (`version` remains `1`)

Additive `GraphEdge` fields: `label?`, `label2?`, `tooltip?`, `style?: GraphEdgeStyle`. Existing `alarms?`, `waypoints?`, `kind?`, `data?` keep their roles; `data` is business-only — the renderer does not read visual keys from it.

`GraphEdgeStyle` carries stroke (`stroke`, `strokeHover`, `lineWidth`, `strokeDash`), `alpha` in `[0, 1]` (default `1`), path ratios `labelAt` / `label2At` / `alarmAt` / `tooltipAt` (defaults `0.5` / `0.15` / `0.85` / `0.5`), `labelSide` (`pathLeft` default | `pathRight` | `aboveOrRight` for screen-space H-above / V-right), `tooltipMode`, text/chrome nests, `arrowFrom` (default `false`), `arrowTo` (default `true`), shared `arrow` (`size` / `fill` / `stroke`), and opt-in `route` (`orthogonal` default | `straight` | `arc` + `arcCenter`) — see [edge route arc](../feature/2026-10-22-edge-route-arc.md).

`updateEdge` merges `style` one level (nested objects replace as units). Zod, `asEdge`/`mergeEdge`, and invert round-trip the new fields. `waypoints: []` still clears to auto-route.

### View / Attachment

Abstract `Attachment` is shared. Edge-specific subclasses live under `src/ui/attachment/`: `EdgeLabelAttachment`, `EdgeLabel2Attachment`, `EdgeAlarmAttachment`, `EdgeTooltipAttachment`. Path sampling uses `samplePolylineAt` / `placeAlongPath` (arc-length ratio + `labelSide` offset). Default `pathLeft` preserves demo placement; `aboveOrRight` is opt-in for skill diagrams. Arrows are endpoint paint, not Attachment instances.

`EdgeView` exposes `pathBounds` (polyline AABB + pad) and `unionBounds` / `bounds` (path ∪ scene attachments). Hover-mode tooltips stay off union and paint on overlay when the edge is hovered; always-mode tooltips join scene + union. Long tooltip text wraps like node tooltips ([tooltip wrap](../bug-fix/2026-10-22-tooltip-text-wrap.md)). Hit-testing remains path-only (label clicks do not select the edge).

### Paint / Network

`EdgePaintView` carries path/union bounds, points, alpha, resolved stroke/width/dash, arrow paints, `attachments`, and `overlayAttachments`. `drawEdge` applies `globalAlpha`, strokes from `style`, draws arrows, then scene attachment ops. Overlay redraws selected/hovered edges (and their overlay attachments). Engine defaults preserve thicker highlight + hover color when `select`/`hover` nests are omitted.

## Alternatives considered

- **Partial style-only lift (keep `data.label`):** rejected — dual paint sources; diverges from GraphNode content fields.
- **One-release `data.*` fallback then cut:** rejected — doubles test matrix.
- **Permanent style↔data mirror:** rejected — patch/invert and AI document surface become ambiguous.
- **Discrete anchors `from`/`mid`/`to` only:** rejected in favor of path ratios.
- **Per-end full arrow objects:** deferred — shared `arrow` + booleans cover uni/bi-directional links.
- **Reuse Node `LabelAttachment` classes with host branching:** rejected — couples box placement to path sampling.
- **Separate `src/ui/edge-attachment/` tree:** rejected — share the lean `Attachment` base under one folder.
- **Serialized `attachments[]` on `GraphEdge`:** rejected — same rationale as GraphNode approach B.
- **Bundle / LinkHandler / ShapeLink in this wave:** deferred — gap backlog / non-goals.

## Consequences

- Documents that still put stroke/label under `data` lose those visuals until hosts set `label` / `style` (version stays `1`).
- Default `arrowTo: true` adds arrowheads on existing edges; hosts may set `arrowTo: false`.
- Wave I bend editing and create/delete interactions are unchanged.

## Testing

- `tests/edge-attachments.spec.ts` — dual bounds, label/label2/alarm ops, arrow defaults, alpha, style merge vs ignored `data`, hover/always tooltip.
- `tests/edge-label-side.spec.ts` — `labelSide` pathLeft / pathRight / aboveOrRight placement.
- Fixture `fixtures/editor.json` uses `label` + `style` on edges.
- Package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

## Deferred

Multi-edge bundle / `LinkHandlerAttachment`; ShapeLink / freeform polylines; self-loops; Icons on edges; path-tangent rotated labels.

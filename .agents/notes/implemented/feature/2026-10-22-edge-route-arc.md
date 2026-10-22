# Agent Note: Edge route modes — arc and straight

Status: implemented

## Problem

Ring / flywheel diagrams (e.g. 业务八环节环) need circular arcs between stations and radial spokes into a hub. The engine only offered orthogonal H/V polylines (and ignored diagonal chords). Skill routing sent geometric loops to the **svg** track, which cannot host SubNetwork drill-down. Authors needed an opt-in non-orthogonal route while keeping `orthogonal` as the engine default.

## Decision

Additive `GraphEdgeStyle` fields (`version` stays `1`):

| Field | Role |
|---|---|
| `route` | `"orthogonal"` (default) \| `"straight"` \| `"arc"` |
| `arcCenter` | `{ x, y }` world — **required** when `route: "arc"` (Zod fails loud) |
| `arcRadius` | optional shared radius; omitted → mean of endpoint distances |
| `arcClockwise` | default `true` (canvas y-down clockwise) |

- `orthogonal` — unchanged (`edgeAnchors*` + `orthogonalizePolyline`).
- `straight` — chord between resolved anchors (radial spokes).
- `arc` — endpoints are **projected onto** the circle (`buildCircularArc`); paint uses `ctx.arc` via `EdgePaintView.arc`. Densified points remain for hit / labels / arrows. Ring diagrams should set an explicit shared `arcRadius` so box-side anchors do not leave radial kinks.

Clean-room note: twaver `link.type: arc` is a **bundle bulge** along the chord, not a shared-center ring arc. This feature implements the ring geometry the skill needs; it does not clone twaver’s bundle-arc control points.

Waypoints are ignored for `straight` / `arc` (anchors still apply).

### Radial anchors (spoke ends)

`fromAnchor` / `toAnchor` accept `"radial"`: exit of the own-center → peer-center ray on the box AABB (`radialAnchor` in `src/ui/bounds.ts`). Optional `fromOutset` / `toOutset` (world px) push that port outward toward the peer — e.g. lake hub spokes use `toOutset: 6` so the tip sits just outside the dark fill, matching the reference HTML.

## Alternatives considered

- **SVG-only for rings:** rejected for this product path — SubNetwork drill-down requires GraphDocument / aitopo.
- **Author Bezier control points in JSON:** rejected — higher authoring cost; ring needs one shared center.
- **Change global default away from orthogonal:** rejected — skill vs engine principle; opt-in per edge.
- **Clone twaver bundle `arc`:** deferred — different geometry; open a follow-up if bundle offsets are needed.

## Consequences

- Skill dialect teaches `route: "arc"` + `arcCenter` for loop layouts; orthogonal remains the default preference for architecture corridors.
- Bend-edit UX on arc/straight edges is out of scope this change (handles still assume orthogonal corridors).

## Testing

- `tests/edge-route-arc.spec.ts` — sample densify, parse requires `arcCenter`, EdgeView arc/straight points.

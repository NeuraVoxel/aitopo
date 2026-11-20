# Agent Note: Edge link styles (twaver-inspired routes)

Status: implemented

## Problem

The Edge demo and authors only had `orthogonal` / `straight` / ring `arc`. Relative to twaver `link.type` and related styles, AITopo lacked orthogonal variants, flexional, extend, chord bundle shapes, ShapeLink, self-loops, corner modes, flow dash animation, multi-edge bundle offsets, and arrow head shapes — so the gallery could not parameterize a full link catalog.

## Decision

`GraphEdgeStyle` / `GraphEdge` gain clean-room fields (`version` stays `1`):

| Field | Role |
|---|---|
| `route` | existing + `orthogonalHV`/`orthogonalVH`/`orthogonalHorizontal`/`orthogonalVertical`, `flexional`(+H/V), `extendTop\|Left\|Bottom\|Right`, `bundleArc`/`triangle`/`parallel`, `shape` |
| `routeExtend` | flexional stub / extend distance (default `20`) |
| `routeOffset` | perpendicular offset for bundle shapes when alone (default `0`) |
| `corner` / `cornerRadius` | `none` \| `round` (default) \| `bevel`; radius default `8` |
| `flow` / `flowConverse` | animated dash offset on the Network paint loop |
| `loopedType` / `loopedDirection` / `loopedGap` | when `from === to` |
| `bundle` / `bundleGap` / `bundleOffset` | same-endpoint sibling fan (default participate) |
| `shapeKind` + `GraphEdge.shapePoints` | ShapeLink densify (`lineto`/`quadto`/`cubicto`/`orthogonalto`) |
| `arrow.shape` | `standard` \| `delta` \| `diamond` \| `short` \| `slant` |

Ring `route: "arc"` + `arcCenter` unchanged. twaver chord `arc` maps to `bundleArc`. Geometry lives in `src/ui/edge-link-route.ts`; `EdgeView` / `ViewSet` / Canvas2D wire paint. Edge demo catalogs every route plus corner/arrow/loop/flow/bundle/shape and keeps the Group fold section.

## Alternatives considered

- **Demo-only catalog without engine:** rejected — engine-first completeness was required.
- **Clone twaver `link.type` string literals as public API:** rejected — clean-room rename policy.
- **Ship route types only, defer ShapeLink/flow/bundle/arrows:** rejected — product asked to handle them together.

## Consequences

- Skill dialect stays orthogonal-first; new routes are opt-in per edge.
- Any `flow: true` edge keeps the Network scene paint loop warm (perf trade).
- ShapeLink quad/cubic densify is approximate for hit-testing.
- Collapsed “bundle agent” single-link UX from twaver is not cloned; fan-out is the shipped multi-edge behavior.
- `updateEdge` patches use the unreified edge object schema so Zod `.partial()` stays valid.

## Testing

- `tests/edge-link-styles.spec.ts` — builders, parse gates, EdgeView polylines, bundle fan, paint DTO fields.
- `tests/edge-route-arc.spec.ts` — ring arc still requires `arcCenter`.
- `tests/demo-registry.spec.ts` — Edge sample parses and exposes ≥10 distinct `style.route` values.

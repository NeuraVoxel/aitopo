# Agent Note: Collapse keeps two-segment complementary elbows

Status: implemented

## Problem

Edges pinned `fromAnchor=bottom` / `toAnchor=right` with a single corridor waypoint painted as two orthogonal segments when expanded. On Group collapse, remapped endpoints cleared waypoints and fell through `orthogonalVH` / `orthogonalHV`, which insert a mid-axis Z (**three** segments). Authors could not keep right-side arrival plus two segments across expand/collapse without fake stub nodes.

## Decision

`complementaryElbow` builds a relative corner for orthogonal leave/arrive pairs (`(from.x, to.y)` for vertical→horizontal, `(to.x, from.y)` for horizontal→vertical). `edgeAnchorsFromRects` prefers that elbow over absolute waypoints or the mid Z. Collapse remapping **keeps** waypoints for complementary pairs (elbow still wins from live anchors); non-complementary remaps still drop absolute corridors so expanded elbows do not float on the card. Document waypoints are unchanged.

## Alternatives considered

**Always keep absolute waypoints after remap.** Rejected: multi-bend corridors authored for the expanded layout misalign on the collapsed body.

**Require Group-external stub nodes.** Rejected by product; path policy must live in the engine.

## Consequences

`bottom→right` (and peers) stay two segments with right-side arrival when the target Group folds. Parallel-side edges (`bottom→top`, `left→right`) still use the mid Z when unhinted corridors are cleared on remap.

## Testing

`tests/edge-complementary-elbow.spec.ts` — elbow geometry; expand/collapse same segment count for `e-val-mid`-shaped edge. `tests/nested-groups.spec.ts` — non-complementary remapped corridors still ignored for paint.

# Agent Note: Collapse remap ignores authored edge waypoints (view-only)

Status: implemented

## Problem

After Group collapse, cross edges remapped to the collapsed band still routed through authored `waypoints` from the expanded layout. Bend handles (Edit mode) also used member boxes + those waypoints, so control points stayed on the old corridor instead of the new band→peer path.

## Decision

- `EdgeView.validate`: when either endpoint is collapse-remapped, pass **no** waypoints into orthogonal routing (auto H/V between remapped boxes). Document `waypoints` are unchanged and apply again when both ends are visible.
- `MoveEdgeBendInteraction`: hide bend handles while either endpoint sits under a collapsed group (avoid editing absolute corridors that only make sense when expanded).

## Alternatives considered

**Keep waypoints and orthogonalize diagonals (prior behavior).** Rejected: corridors authored for member boxes look wrong on the collapsed card; users reported stale control points.

**Clear `waypoints` from the document on collapse.** Rejected: destroys authoring; expand would lose corridors.

## Consequences

Collapsed agent links look like fresh auto routes. Expanding restores waypoint-driven corridors. Bend edit while collapsed is unavailable until the group opens.

## Testing

`tests/nested-groups.spec.ts` — collapsed path skips corridor y; document waypoints retained. `pnpm test` for bend / group suites.

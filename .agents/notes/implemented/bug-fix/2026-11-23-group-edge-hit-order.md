# Agent Note: Intra-group edge hit above band fill

Status: implemented

## Problem

Edges whose path lies over an expanded Group band could not be selected: `hitTestScreen` tested full `bandBounds` before edge polylines, so the group always won under the pointer even though paint draws edges above groups.

## Decision

- `Network.hitTestScreen` hit order is **nodes → edges → groups**, the reverse of scene paint (`groups → edges → nodes`), matching twaver `getElementAt` top-down over the paint stack.
- Edge hits stay distance-to-polyline with the existing zoom-scaled pad; empty band chrome away from a wire still returns the group.
- No LayerBox / `adjustLinkIndex` port: aitopo has a fixed three-pass paint order; reversing that order for hit is enough for link-over-band selection.

## Alternatives considered

**Hit only group chrome (title strip), not the fill.** Rejected: band fill is a valid group target for select/drag/drop; narrowing chrome would break empty-band selection without fixing edges that cross the title strip.

**Port twaver LayerBox + `adjustLinkIndex`.** Rejected (YAGNI): selection failure was hit-order vs paint-order, not missing per-element layers; full LayerBox is a larger architecture change.

## Consequences

Clicking a wire that crosses a group fill selects the edge; clicking empty fill still selects the group; nodes remain topmost. Callers that assumed “group before edge” in `hitTestScreen` must treat edges as higher than groups. Edge name hit is covered separately in [edge label hit](./2026-11-23-edge-label-hit.md).

## Testing

`tests/hit-views.spec.ts` “hits an intra-group edge above the expanded group band (paint order)” — mid-segment over the band returns the edge; off-wire band point returns the group.

# Agent Note: Edge label / name hit for selection

Status: implemented

## Problem

Edge selection only measured distance to the stroke polyline. Clicking the painted label (`GraphEdge.label` / `label2`) missed the edge even though twaver link attachments participate in `getElementAt` via attachment hit.

## Decision

- `EdgeView.hitsAttachment(point)` returns true when a union-contributing attachment (`label`, `label2`, alarm, always-mode tooltip) contains the point — same `Attachment.hit` rect check already used for paint bounds.
- `Network.hitTestScreen` treats an attachment hit as distance `0` for that edge (wins over farther strokes), then still falls back to polyline distance within the existing zoom-scaled pad.
- Hover-only tooltips stay non-hittable because `contributesToUnion()` is false.

## Alternatives considered

**Hit the whole `unionBounds` AABB.** Rejected: the AABB spans path + label and would select the edge when clicking empty space between stroke and name.

**Pixel-perfect canvas sample like twaver `hitCanvasRect`.** Rejected (YAGNI): validated label boxes already match paint placement; rect hit is enough for selection.

## Consequences

Clicking an edge name selects that edge; stroke hit behavior is unchanged. Callers that assumed “edge hit equals polyline-only” must account for label boxes.

## Testing

`tests/hit-views.spec.ts` “hits an edge via its label attachment away from the stroke” — label center (farther than polyline pad) returns `{ id: 'named', kind: 'edge' }`.

# Agent Note: ShapeNode member drag left a residual body

Status: implemented

## Problem

In the Elements `shape-node` sample, dragging the group member `in-group` (label `member`) left a filled copy at the old position while the selected body moved. Freestanding shape nodes did not show the same ghost.

## Decision

`captureShapeNodeGeometryRects` / `capturePathGeometryRects` checked `view.isActive === true`, but `ShapeNodeView` / `PathView` have no `isActive` flag — the check always failed. For a grouped shape the dirty union then contained **only** the owning group band. When the band did not wrap the shape (autofit ignored shape-node members), root clear missed the filled body; overlay still painted the moved selection → two “member” shapes.

Fixes in the same change:

1. Dirty path/shape by densified bounds + `elementPaintPad` (selection glow), never via a missing `isActive`.
2. Include shape-node members in group autofit (`listGroupShapeNodes` + `ShapeNodeBoundsResolver`), and dirty the owning group chain on shape preview like boxed nodes.

## Alternatives considered

- **Always `markAll` on shape/path preview:** rejected — hides the real hole; full-frame every drag frame is unnecessary once bounds are captured.
- **Paint selected path/shape only on overlay (skip root base):** rejected — edges already keep a root base so unhover does not leave holes; same rule should hold for paths/shape nodes.

## Consequences

- Group bands grow around shape-node members when expanded + autofit.
- Expand/collapse still translates boxed nodes / child groups only (shape-point translation remains a follow-up).
- Path preview dirty also covers the stroke AABB (same `isActive` bug); freestanding paths previously fell through to full-frame by accident.

## Testing

- `tests/paint-channels.spec.ts` — `previewShapeNodePoints` dirty covers the shape body (y past the tiny authored band).
- `tests/graph-shape-node.spec.ts` — autofit band unions shape-node members.

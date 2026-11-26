# Agent Note: vectorImage heading arrow left a drag residual

Status: implemented

## Problem

In the Elements Node sample, dragging `heading-boost` (and `heading`) left a ghost of the speed/yaw arrow at the previous world position. The body moved cleanly; only the out-of-box vector overlay stayed.

## Decision

`NodeView` dirty/cull union was body ∪ attachments only. `demo-heading-arrow` paints shaft, chevron, and label past the body, so `previewNodePosition` cleared a rect that missed the old arrow.

- `VectorImageDefinition.bounds?(body, paintCtx)` returns unrotated ink AABB.
- `NodeView.validate` unions that rect into `originalUnion` before rotating about `angleAnchor`.
- Demo heading registration supplies `bounds` aligned with `draw`.

## Alternatives considered

- **Always `markAll` while dragging vectorImage nodes:** rejected — hides the missing-bounds hole and costs full-frame clears.
- **Clip vectorImage paint to body:** rejected — heading arrows must extend past the vehicle box.

## Consequences

Registered vector images that paint outside the body must implement `bounds`, or drag residuals return. Hit-testing still uses body/attachments (arrow ink is not a hit target this wave).

## Testing

- `tests/vector-image.spec.ts` — NodeView union extends above the body when `bounds` is provided.

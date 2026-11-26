# Agent Note: Partial dirty expands to intersecting neighbors

Status: implemented

## Problem

ADAS Ego pulses `heading` `vectorImagePhase`. At peak arrow length the heading dirty AABB grazed `heading-boost`. Root `clearRect` + clip punched a strip through boost; boost was only partially redrawn under that clip, leaving AA / rotated-ink residuals on the boost vehicle.

## Decision

Before a partial scene paint, expand the dirty seed with `expandPartialDirty`: while any node / group / edge / path / shapeNode padded paint AABB intersects the region and is not already contained, union its **full** padded bounds (each element absorbed at most once; non-finite AABBs skipped). Clear and clip then cover whole neighbors; cull still skips distant elements.

Also: `Network.load` consumes `scene.takeDirty()` after rebuild so the load-time `invalidateAll` does not linger and force the first `apply()` into `markAll` (which skipped old/new element rect capture).

## Alternatives considered

- **Always `markAll` while any vectorImage animates:** rejected — full-frame every 50ms is unnecessary once neighbors are fully included.
- **Only space the Ego sample farther apart:** rejected as the sole fix — any overlapping paint AABBs can reproduce the seam.

## Consequences

Pulsing or editing an element whose dirty AABB overlaps a sibling forces that sibling into the same partial frame. Each element is absorbed at most once; non-finite AABBs are skipped so a NaN pad cannot hang the `while` loop (NaN makes intersect true and contains false forever).

## Testing

- `tests/paint-channels.spec.ts` — overlapping neighbor enters partial dirty and is drawn; distant node is not.
- `tests/ego-drag-hang.spec.ts` — ADAS ego preview-drag under phase pulse stays finite and terminates.

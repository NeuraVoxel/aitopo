# Agent Note: Far-endpoint dirty residual while dragging

Status: implemented

## Problem

In the hello demo, dragging node `To` left a residual seam on stationary `From`. Preview dirty for a move unioned the mover and incident edge AABBs; the edge box typically clips only a strip of the far endpoint. Clearing that strip and redrawing under clip cut through `From`'s body/shadow, which read as a ghost on `From`.

## Decision

When dirtying a moved node (preview and apply sync), also grow the **far endpoint** node/group bounds into the dirty union (with `elementPaintPad` for drop shadow / selection glow). Partial edge AABB alone is not enough. Mover pads use the same helper so selection glow (`glowBlur` default 16) clears with the body.

## Alternatives considered

- **Always `markAll` on connected moves:** rejected — pays full-frame cost for every drag frame.
- **Disable draw culling:** rejected — culling is fine when the dirty hole fully covers painted extents; the hole was undersized.
- **Larger constant pad on edges only:** rejected — still misses a far body whose center sits outside a thin edge strip.

## Consequences

- Dragging one end of a link fully repaints the other end when the edge dirty would otherwise slice it.
- Selection/move dirty grows with glow/shadow instead of a fixed `8`/`24` guess.

## Testing

- `tests/paint-channels.spec.ts` — preview move of `To` yields dirty `minX ≤ 80` (full `From`) and redraws both nodes.

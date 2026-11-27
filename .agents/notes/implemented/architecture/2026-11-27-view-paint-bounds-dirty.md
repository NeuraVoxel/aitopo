# Agent Note: Bake paint extents into View bounds for dirty seeds

Status: implemented

## Problem

Per-element dirty seeds were inflated twice: Views stored geometry unions, then Network / GestureEditor re-applied `elementPaintPad` (minimum 8, often selection glow ~20) and a blind `+8` on edges/paths. That made single-element footprints much larger than twaver’s `getZoomViewRect` (body + attachments with shadow/glow baked in validate, then Network `grow(2,2)`).

## Decision

Align single-element footprints with twaver.vector ideas (clean-room names):

1. **Bake extents in View validate** — Node/Group expose `paintBounds` = geometry `bounds` grown by `paintExtentGrow` (`blur + |offsetX| + |offsetY| + PAINT_SHADOW_EXTENT_PAD`, vs `glowBlur + PAINT_GLOW_EXTENT_PAD`, take max; worst-case selection glow). Edge/Path/ShapeNode bake stroke (and edge arrow size) into path AABB; `paintBounds` aliases that box. Demo property panel exposes node/group `style.shadow` + `style.select.glow*` so hosts can tune the cyan paint AABB live (see [property panel paint extent](../feature/2026-11-27-property-panel-paint-extent.md)).
2. **Dirty capture uses `view.paintBounds`** — apply sync, preview capture, selection/hover dirty, far-endpoint seeding, draw cull, and `expandPartialDirty` absorb via `paintBounds` with no second pad.
3. **Final AA grow** — `expandPartialDirty` grows the seed by `DIRTY_SEED_AA_GROW` (2) once, matching twaver’s union grow.

**Keep** far-endpoint full-body seeding and neighbor flood expand (+ absorb cap). No multi-rect accumulator and no lift-to-overlay in this change.

Hit-test / layout keep geometric `bounds` (and `originalUnionBounds` when rotated). Dirty / paint cull use `paintBounds`.

## Alternatives considered

- **Drop far-endpoint + expand (full twaver invalidate set):** rejected for this slice — residual safety stays; only per-element footprint tightens (option A).
- **Keep `elementPaintPad` at every capture site:** rejected — double-counts extents already in View.bounds.
- **Bake glow only when currently selected:** rejected — selection chrome is root-painted; worst-case glow in bounds avoids clear holes when selection toggles without a second pad path.

## Consequences

- Solo / sparse edits clear a tighter dirty hole (body + baked shadow/glow + 2px).
- Connected moves still grow via incident edges, far endpoints, and expand (unchanged policy).
- `elementPaintPad` remains as a legacy helper with min-8; new code uses `paintExtentGrow` + baked bounds.
- Hosts that assumed dirty unions included an extra Network pad of 8 may see slightly smaller partial clips (still ≥ paint ink).

## Testing

- `tests/paint-channels.spec.ts` — solo node preview dirty stays near body+AA grow; far-endpoint, neighbor-expand, absorb-cap cases remain.

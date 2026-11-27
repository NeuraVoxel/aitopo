# Agent Note: Debug OBB / AABB overlay

Status: implemented

## Problem

The Debug toolbar toggle only stroked dirty-rect unions. Contributors debugging paint pads, rotation, and attachment layout needed twaver-like per-element bounds: oriented boxes inside the host, then a final AABB envelope, including every attachment region — not a single node AABB.

## Decision

When `debugPaintRects` is on (demo **Debug**), each validate paints:

1. **Oriented parts (OBB when angled):** body/band/path/shape plus every attachment `bounds`, stroked in host space rotated about the element pivot (`lineWidth = 1 / zoom`).
2. **Final AABBs:** geometry union and paint extent (where the view exposes both), stroked axis-aligned after the OBBs.
3. **Dirty unions:** unchanged red overlay strokes in `endFrame`.

Views expose `debugBounds()`; `Network` collects them onto `Renderer.drawDebugElementBounds` before `endFrame`. Colors live in `src/render/debug-bounds.ts` (clean-room palette, not twaver API names).

## Alternatives considered

- **Stroke only rotated AABB of the whole node:** rejected — hides attachment layout and does not match the twaver “OBB inside, AABB outside” read.
- **Separate Debug Modes toggle for dirty vs element bounds:** rejected — one Debug flag already remounts paint; stacking modes adds UI without a product ask.
- **World-space attachment AABBs without host rotation:** rejected — attachments are authored in unrotated host space; OBB stroke must share the host angle/pivot.

## Consequences

- Turning Debug on shows orange body OBBs, gray attachment OBBs, green geometry AABB, cyan paint AABB, and red dirty unions.
- Headless / fake renderers may omit `drawDebugElementBounds`; Network no-ops collection consumers when the method is absent.
- Related dirty footprint work: [view paintBounds dirty](../architecture/2026-11-27-view-paint-bounds-dirty.md).

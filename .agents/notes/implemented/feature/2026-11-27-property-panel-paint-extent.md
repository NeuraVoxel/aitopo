# Agent Note: Property panel paint-extent controls

Status: implemented

## Problem

Debug overlays show geometry AABB vs larger paint AABB, but contributors could only change selection glow in the demo inspector. Drop-shadow inputs to `paintExtentGrow` (`blur`, offsets) lived only in document JSON, so tuning the cyan paint footprint meant hand-editing style.

## Decision

Demo property panel (node/group) exposes:

- `shadow` on/off → `style.shadow: null` vs shadow object
- `shadow blur` / `shadow ox` / `shadow oy` / `shadow color` → `style.shadow.*`
- existing `select glow` / `glow blur` continue to drive the glow half of `paintExtentGrow`

Engine formula pads are named exports (`PAINT_SHADOW_EXTENT_PAD`, `PAINT_GLOW_EXTENT_PAD`, `DEFAULT_GLOW_BLUR`, `DEFAULT_NODE_SHADOW`) and `|offsetX|` joins the shadow extent. Pad overrides exist only as `paintExtentGrow` args for tests/tooling, not protocol fields.

## Alternatives considered

- **Expose +2/+4 pads as GraphDocument style fields:** rejected — they are engine soft-edge slop, not authoring chrome; property panel tunes the ink parameters instead.
- **Network-level Debug sliders for pads only:** rejected — product asked for the property panel; per-element shadow/glow already maps to protocol.
- **Keep shadow editable only via `data` JSON:** rejected — does not surface the paint-extent knobs next to Debug overlays.

## Consequences

- Turning shadow off or lowering blur/glow shrinks cyan `paintBounds` (and red dirty when that element seeds).
- Node shadow writes merge from `DEFAULT_NODE_SHADOW` when `style.shadow` was omitted; groups start from `{}`.
- Related bake policy: [view paintBounds dirty](../architecture/2026-11-27-view-paint-bounds-dirty.md).

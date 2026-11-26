# Agent Note: Selection glow chrome

Status: implemented

## Problem

Hover chrome was only a dashed overlay ring, and selection was a solid ring with no soft halo. Authors coming from twaver expected a glow (`outer.style: glow` + `glow.blur`) on the **selected** element, while hover should stay a light dashed ring. An early pass painted selection glow as a semi-transparent fill on the overlay, which read as a veil over the node body.

## Decision

`GraphChromeStyle` gains optional `glow` / `glowBlur`. Optional `alpha` (highlight opacity) is owned by [chrome alpha FOV highlight](../bug-fix/2026-11-26-chrome-alpha-fov-highlight.md). Defaults:

| Chrome | Glow when omitted | Where it paints | Ring |
|---|---|---|---|
| Hover | **off** (dashed ring only) | overlay (opt-in fill+blur) | dashed |
| Selection | **on** (`glowBlur` default `16`) | **under body fill** on root via `shadowBlur` on the fill (twaver outer glow) | solid overlay ring |

Opt in hover glow with `style.hover.glow: true`. Opt out selection glow with `style.select.glow: false`.

`Network.setSelection` schedules a scene paint (dirty grown for previous + next selection) so under-body glow appears and clears; hover stays overlay-only. Partial dirty frames **cull** root `draw*` calls to elements whose bounds intersect the dirty union (not only canvas clip), so selecting one node does not re-issue draws for distant nodes. Move/preview dirty also grows **far edge endpoints** so an edge AABB cannot leave a strip residual on the stationary end — see [far-endpoint residual](../bug-fix/2026-11-20-far-endpoint-dirty-residual.md).

## Alternatives considered

- **Glow on hover by default:** rejected after product feedback — hover keeps the dashed ring; selection owns the halo.
- **Only document `style.shadow` toggled by the host on select:** rejected — selection chrome belongs in the engine.
- **Selection glow as overlay fill + blur:** rejected — reads as a veil over the node; twaver paints glow with the body fill so the opaque fill covers the halo core.

## Consequences

- Default select appearance gains a soft blue halo behind every selected node/group body, plus the solid overlay ring.
- Selection changes are no longer overlay-only frames; they use grown dirty + draw culling.
- Hover appearance stays the prior dashed ring unless an author sets `hover.glow`.

## Testing

- `tests/hover-glow.spec.ts` — body fill blur 16 by default; `select.glow: false`; overlay ring has no fill; hover default no fill; `hover.glow: true` opt-in.
- `tests/paint-channels.spec.ts` — `setSelection` scene-paints only nodes intersecting dirty (not distant peers); `setHover` overlay-only.

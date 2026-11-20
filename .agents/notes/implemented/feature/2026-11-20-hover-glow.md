# Agent Note: Selection glow chrome

Status: implemented

## Problem

Hover chrome was only a dashed overlay ring, and selection was a solid ring with no soft halo. Authors coming from twaver expected a glow (`outer.style: glow` + `glow.blur`) on the **selected** element, while hover should stay a light dashed ring.

## Decision

`GraphChromeStyle` gains optional `glow` / `glowBlur`. Defaults:

| Overlay | Glow when omitted | Ring |
|---|---|---|
| Hover | **off** (dashed ring only) | dashed |
| Selection | **on** (`glowBlur` default `16`) | solid |

Opt in hover glow with `style.hover.glow: true`. Opt out selection glow with `style.select.glow: false`.

## Alternatives considered

- **Glow on hover by default:** rejected after product feedback — hover keeps the dashed ring; selection owns the halo.
- **Only document `style.shadow` toggled by the host on select:** rejected — selection chrome belongs in the engine overlay path.

## Consequences

- Default select appearance gains a soft blue halo for every node/group using stock overlay paint.
- Hover appearance stays the prior dashed ring unless an author sets `hover.glow`.

## Testing

- `tests/hover-glow.spec.ts` — selection default blur 16; `select.glow: false`; hover default no fill; `hover.glow: true` opt-in.

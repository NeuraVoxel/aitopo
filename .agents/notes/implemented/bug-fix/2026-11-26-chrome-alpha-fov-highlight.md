# Agent Note: GraphChromeStyle.alpha for FOV highlight

Status: implemented

## Problem

ADAS FOV wedges idle at low `style.alpha` so stacked sensors stay readable. Select/hover only swapped stroke color/width via `GraphChromeStyle`, so the filled sector stayed nearly invisible when highlighted.

## Decision

`GraphChromeStyle` gains optional `alpha`. While select or hover chrome is active, Path / ShapeNode / Node paint DTOs use that opacity (clamped) instead of the element's base alpha. Omitted `chrome.alpha` keeps prior behavior.

ADAS `fovWedge` (`demo/samples/adas/sector.ts`) sets select/hover chrome with raised alpha, thicker stroke, and glow so FOV / Sensor wedges pop without raising idle opacity.

## Alternatives considered

- **Only thicken stroke / enable glow:** rejected — translucent fills dominate wedge readability; stroke alone stays weak.
- **Host toggles `style.alpha` on selectionChanged:** rejected — chrome belongs on the element; every FOV author would reimplement the boost.
- **Hardcoded select alpha in the renderer:** rejected — authors need per-element control (faint lanes vs loud FOV).

## Consequences

- Translucent Path/ShapeNode authors can author highlight opacity beside stroke chrome.
- FOV and Sensor demos share the louder highlight through `fovWedge`.

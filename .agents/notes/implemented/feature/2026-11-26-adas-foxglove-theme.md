# Agent Note: ADAS Foxglove theme

Status: implemented

## Problem

ADAS demos painted only through nuBoard tokens. Contributors also want a Foxglove Studio–flavored look (brand violet + dark neutrals from foxglove.dev) without forking every sample or inventing ad-hoc hex chrome.

## Decision

ADAS chrome goes through `demo/lib/adas-theme.ts` (`ADAS_*` getters). Registered palettes share one token shape:

| Theme id | Palette module | Role |
|---|---|---|
| `nuboard` (default) | `demo/lib/nuplan-palette.ts` | motional/nuplan-devkit `nuboard/style.py` |
| `foxglove` | `demo/lib/foxglove-palette.ts` | foxglove.dev brand violet `#a56eff` + studio neutrals |
| `rviz` | `demo/lib/rviz-palette.ts` | classic RViz defaults (`#303030` bg, `#a0a0a4` grid, TF RGB / map unknown `#708986`) |

`setAdasTheme` / `getAdasTheme` own the active id. `ADAS_THEME_OPTIONS` is the toolbar catalog (append rows for future styles). ADAS sample documents rebuild on access (`get document()` → `build…Document()`). While the active sample’s group is `adas`, the demo toolbar shows a **Theme** dropdown; switching remounts the network. `tests/adas-nuboard-palette.spec.ts` gates hex under `demo/samples/adas/` against the union of registered palettes. Catalog membership stays in [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md).

## Alternatives considered

- **Replace nuBoard with Foxglove as the sole ADAS palette:** rejected — nuBoard remains the default; Foxglove is opt-in.
- **Ship theme tokens only as unused modules:** rejected — without the facade + toolbar remount, themes never reach samples.
- **Duplicate every ADAS sample per theme:** rejected — doubles catalog noise; facade + lazy documents keep one sample id.
- **Keep samples importing `NUPLAN_*` directly:** rejected — theme switch cannot rebuild documents without the `ADAS_*` indirection.

## Consequences

- New ADAS samples import `ADAS_*` from `adas-theme.ts`, never raw hex and never palette files directly.
- Vector ego chrome (`demo/lib/vector-images.ts`) and the ego pulse path read `ADAS_*` at paint/update time.
- Default theme stays `nuboard` across reloads until the toolbar changes it for the session.

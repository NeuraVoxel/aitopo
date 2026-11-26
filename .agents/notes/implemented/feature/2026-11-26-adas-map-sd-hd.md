# Agent Note: ADAS Map demo (SD | HD)

Status: implemented

## Problem

ADAS had lane corridors and removed the old HD junction sketch, but no catalog row compared **SD Map** (topological centerlines) with **HD Map** (lanes / connectors / signals) on the same scene.

## Decision

Add loadable `adas-map` (title **Map**), ordered after Lane and before OCC:

| Panel | Content |
|---|---|
| Left **SD** | Parametric S-curve trunk (Lane-demo style) with `J1`/`J2`/`J3` + short E/W/park arms + ego |
| Right **HD** | Same spine; dual-lane ribbons; conditions **spread**: signals/stop/XW at **J1**, walkway mid-trunk, PUDO at **J2**, carpark at **J3**, roadblock on south approach |

Shared local spines translated into two panel origins. Chrome via `ADAS_*` only. Schematic, not official tiles. Catalog membership: [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md).

## Alternatives considered

- **Separate SD / HD catalog rows:** rejected — product chose one-page side-by-side comparison.
- **SD-only centerlines without a shared HD twin:** rejected — the point is the fidelity delta on one shared corridor.
- **Pack all HD overlays at a single crossroads:** rejected — conditions belong at different junctions / segments along a longer curved network.
- **Revive deleted `adas-hdmap-junction` alone:** rejected — SD|HD pair is the new story; old row stayed trimmed.

## Consequences

- ADAS loadable set is eight rows.
- Map authors reuse Lane primitives (ShapeNode / Path / successor Edge) without a new engine type.

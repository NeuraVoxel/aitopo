# Agent Note: OCC ego-centric perception sample

Status: implemented

## Problem

After splitting stress into Elements **Perf**, OCC still looked like a decorative free/occupied/unknown checkerboard centered on ego — not a BEV occupancy frame a stack would emit (range fringe, occlusion shadows, metric cells, detections on top).

## Decision

Rebuild `adas-occupancy-bev` as an **ego-centric perception snapshot**:

- ~0.5 m cells (`CELL_M` × `PX_PER_M`), ego near bottom-center facing forward.
- Occupied stamps sized like curb / parked / lead vehicle / pedestrian in ego meters.
- Unknown outside sensor range / FOV and along rays blocked by occupied cells; free elsewhere in FOV.
- Layers `occupancy` (not movable) + `agents`; tracked Vehicle / Ped boxes + axle-frame Ego on `agents`.

Engine stress remains [Elements Perf](./2026-11-27-elements-perf-grid-sample.md).

## Alternatives considered

- **Keep abstract salt-and-block grid:** rejected — product asked to approximate real detection OCC.
- **Full ray-traced lidar sim / probabilistic log-odds:** rejected — demo fidelity, not a perception stack; deterministic AABB + Bresenham occlusion is enough to read.
- **OCC cells only, no detection boxes:** weaker — fused BEV UIs usually show tracks on the grid.

## Consequences

- Catalog description and registry assert layers, three occupancy kinds, and `det-*` overlays.
- Occupancy layer is non-movable so marquee/select-all on the map does not bulk-drag every cell by default when hosts respect layer `movable`.

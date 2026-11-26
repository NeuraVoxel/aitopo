# Agent Note: Demo ADAS sample group

Status: implemented

## Problem

ADAS (autonomous-driving) visualization needs a dedicated demo catalog home. Contributors were mixing domain sketches into Elements / Business, and freestanding lane geometry was not yet an engine primitive — so the catalog had nowhere to show what works today versus what stays reserved.

## Decision

The demo catalog adds group id `adas` (nav label **ADAS**), ordered after `elements` and before `agents`. Samples use shipped protocol primitives (`GraphNode` / `GraphEdge` / `GraphGroup` / `GraphPath` / alarms).

**Theme chrome:** samples paint through the ADAS theme facade — ownership and Foxglove opt-in live in [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md) (default remains nuBoard). Shared helpers live in `demo/samples/adas/shared.ts`.

| Sample id | Load | Role |
|---|---|---|
| `adas-ego` | yes | Eight ego styles (nuPlan/nuBoard palette): heading / angle / length / pulse / vector+bitmap car / axle frame / plan+follow cubicto Path |
| `adas-agent` | yes | Dynamic obstacles + heading/speed + confidence Alarm tags + history trails + Vehicle multi-modal prediction Paths around axle-frame ego |
| `adas-static` | yes | Static objects (CZone sign / Barrier / Traffic cone / Unclassified) around axle-frame ego |
| `adas-lane` | yes | S-curve corridor on layers `ground` / `lanes` / `agents`: L0/L1/L2 offset ribbons + CL/boundaries, ego on L1 with heading, successor stub, speed-limit tags (merge stub removed) |
| `adas-map` | yes | Catalog title **Map**: multi-junction corridor SD|HD — long curves through J3→J2→J1; HD conditions spread along corridor ([2026-11-26-adas-map-sd-hd.md](2026-11-26-adas-map-sd-hd.md)) |
| `adas-occupancy-bev` | yes | Catalog title **OCC**: dense 80×50 occupancy GraphNode grid (4k cells, `shadow: null`, paint stress) + axle-frame Ego (ordered under Lane) |
| `adas-fov` | yes | Catalog title **FOV**: camera / radar / lidar wedges as closed GraphShapeNode sectors ([2026-11-26-adas-fov-shapenode.md](2026-11-26-adas-fov-shapenode.md)) |
| `adas-sensor` | yes | Catalog title **Sensor**: six OEM packages side-by-side (Tesla / XPeng / IM / Huawei / Xiaomi / Waymo) — mounts + faint FOV wedges ([2026-11-26-adas-sensor-oem-schemes.md](2026-11-26-adas-sensor-oem-schemes.md)) |

Files live under `demo/samples/adas/` (`index.ts` owns catalog order). No invisible-endpoint ShapeLink fakes. Catalog trim of stop/crosswalk, traffic signals, parking slots, and HD map junction: [2026-11-26-adas-catalog-trim.md](../simplification/2026-11-26-adas-catalog-trim.md).

## Alternatives considered

- **Fold ADAS under Business (soon):** rejected — ADAS is an active visualization lane; a named group makes gaps discoverable.
- **Fake lanes with invisible endpoint Nodes + `route: "shape"`:** rejected — misrepresents `GraphEdge.from`/`to` and teaches the wrong model for freestanding paths.
- **Ship freestanding path / FOV primitives in the same change:** rejected at catalog birth — path later landed as `GraphPath`; FOV later landed as ShapeNode sectors ([2026-11-26-adas-fov-shapenode.md](2026-11-26-adas-fov-shapenode.md)).
- **Drop AABB stand-ins for stop / drivable / occupancy:** rejected — they are honest approximations of what Node/Group can show today, labeled as such in sample descriptions.
- **Keep per-sample Tailwind/ad-hoc hex chrome:** rejected — ADAS demos must read as one themed catalog; palette ownership moved to [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md).

## Consequences

- Eight loadable ADAS rows (no reserved stubs); `adas-lane` is the S-curve consolidated catalog. Thin lane / drivable-area / perception-boxes / VRU / planning-path / prediction rows removed; plan Path lives on Ego, multi-modal prediction + confidence/VRU classes live on Agent.
- Lane / Ego plan / Agent history+prediction use top-level `paths: GraphPath[]`.
- Theme tokens, Foxglove opt-in, and the hex gate are owned by [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md).

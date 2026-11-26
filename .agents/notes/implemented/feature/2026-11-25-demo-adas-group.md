# Agent Note: Demo ADAS sample group

Status: implemented

## Problem

ADAS (autonomous-driving) visualization needs a dedicated demo catalog home. Contributors were mixing domain sketches into Elements / Business, and freestanding lane geometry was not yet an engine primitive — so the catalog had nowhere to show what works today versus what stays reserved.

## Decision

The demo catalog adds group id `adas` (nav label **ADAS**), ordered after `elements` and before `agents`. Samples use shipped protocol primitives (`GraphNode` / `GraphEdge` / `GraphGroup` / `GraphPath` / alarms).

**Theme chrome:** samples paint through the ADAS theme facade — ownership and Foxglove opt-in live in [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md) (default remains nuBoard). Shared helpers live in `demo/samples/adas/shared.ts`. Sector FOV stays reserved until a frustum overlay exists.

| Sample id | Load | Role |
|---|---|---|
| `adas-ego` | yes | Seven ego styles (nuPlan/nuBoard palette): heading / angle / length / pulse / vector+bitmap car / axle frame |
| `adas-agent` | yes | Dynamic obstacles (Vehicle / Pedestrian / Bicycle / Truck / Bus / Unclassified) + heading/speed around axle-frame ego |
| `adas-static` | yes | Static objects (CZone sign / Barrier / Traffic cone / Unclassified) around axle-frame ego |
| `adas-lane` | yes | S-curve corridor on layers `ground` / `lanes` / `agents`: L0/L1/L2 offset ribbons + CL/boundaries, ego on L1 with heading, successor stub, speed-limit tags (merge stub removed) |
| `adas-lane-lines` | yes | Open GraphPath lane markings (solid / dashed) — thin sample |
| `adas-lane-centerline` | yes | Centerline GraphPaths + optional successor edges — thin sample |
| `adas-road-boundary` | yes | Left / right curb GraphPaths — thin sample |
| `adas-stop-crosswalk` | yes | Thin node stop line + Group crosswalk AABB |
| `adas-drivable-area` | yes | GraphGroup rectangle as free-space stand-in |
| `adas-perception-boxes` | yes | Detection boxes as GraphNode AABBs |
| `adas-vru` | yes | Pedestrian / cyclist nodes + attention edges |
| `adas-traffic-signals` | yes | Lights / signs with status and alarms |
| `adas-parking-slots` | yes | Axis-aligned GraphGroup bays (no rotate) |
| `adas-sensor-fov` | reserved | Needs sector / frustum overlay |
| `adas-occupancy-bev` | yes | Coarse occupancy as GraphNode cell grid |
| `adas-planning-path` | yes | Ego + cubicto planning GraphPath |
| `adas-prediction` | yes | Multi-modal prediction GraphPaths (alpha / dash) |
| `adas-hdmap-junction` | yes | Lane-segment topology nodes + successor edges |

Files live under `demo/samples/adas/` (`index.ts` owns catalog order). Reserved ids stay stable for a later loadable flip. No invisible-endpoint ShapeLink fakes.

## Alternatives considered

- **Fold ADAS under Business (soon):** rejected — ADAS is an active visualization lane; a named group makes gaps discoverable.
- **Fake lanes with invisible endpoint Nodes + `route: "shape"`:** rejected — misrepresents `GraphEdge.from`/`to` and teaches the wrong model for freestanding paths.
- **Ship freestanding path / FOV primitives in the same change:** rejected at catalog birth — path later landed as `GraphPath`; FOV remains reserved.
- **Drop AABB stand-ins for stop / drivable / occupancy:** rejected — they are honest approximations of what Node/Group can show today, labeled as such in sample descriptions.
- **Keep per-sample Tailwind/ad-hoc hex chrome:** rejected — ADAS demos must read as one themed catalog; palette ownership moved to [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md).

## Consequences

- Seventeen loadable ADAS rows plus `adas-sensor-fov` reserved; `adas-lane` is the S-curve consolidated catalog while thin lane/boundary samples remain.
- Parking slots are axis-aligned only (rotate handles are still deferred on the engine).
- Lane / boundary / planning / prediction demos use top-level `paths: GraphPath[]`.
- Theme tokens, Foxglove opt-in, and the hex gate are owned by [2026-11-26-adas-foxglove-theme.md](2026-11-26-adas-foxglove-theme.md).

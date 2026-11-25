# Agent Note: Demo ADAS sample group

Status: implemented

## Problem

ADAS (autonomous-driving) visualization needs a dedicated demo catalog home. Contributors were mixing domain sketches into Elements / Business, and freestanding lane geometry is not yet an engine primitive — so the catalog had nowhere to show what works today versus what stays reserved.

## Decision

The demo catalog adds group id `adas` (nav label **ADAS**), ordered after `elements` and before `agents`. Samples use only shipped protocol primitives (`GraphNode` / `GraphEdge` / `GraphGroup` / alarms). Freestanding path / FOV / trajectory work stays reserved.

| Sample id | Load | Role |
|---|---|---|
| `adas-ego-surround` | yes | Ego + four surround vehicles + relative edges |
| `adas-lane-lines` | reserved | Needs freestanding path |
| `adas-lane-centerline` | reserved | Needs freestanding path |
| `adas-road-boundary` | reserved | Needs freestanding path |
| `adas-stop-crosswalk` | yes | Thin node stop line + Group crosswalk AABB |
| `adas-drivable-area` | yes | GraphGroup rectangle as free-space stand-in |
| `adas-perception-boxes` | yes | Detection boxes as GraphNode AABBs |
| `adas-vru` | yes | Pedestrian / cyclist nodes + attention edges |
| `adas-traffic-signals` | yes | Lights / signs with status and alarms |
| `adas-parking-slots` | yes | Axis-aligned GraphGroup bays (no rotate) |
| `adas-sensor-fov` | reserved | Needs sector / frustum overlay |
| `adas-occupancy-bev` | yes | Coarse occupancy as GraphNode cell grid |
| `adas-planning-path` | reserved | Needs freestanding trajectory path |
| `adas-prediction` | reserved | Needs freestanding multi-modal trajectories |
| `adas-hdmap-junction` | yes | Lane-segment topology nodes + successor edges |

Files live under `demo/samples/adas/` (`index.ts` owns catalog order). Reserved ids stay stable for a later loadable flip. No invisible-endpoint ShapeLink fakes.

## Alternatives considered

- **Fold ADAS under Business (soon):** rejected — ADAS is an active visualization lane; a named group makes gaps discoverable.
- **Fake lanes with invisible endpoint Nodes + `route: "shape"`:** rejected — misrepresents `GraphEdge.from`/`to` and teaches the wrong model for freestanding paths.
- **Ship freestanding path / FOV primitives in the same change:** rejected — catalog uses current engine only; unsupported rows stay reserved.
- **Drop AABB stand-ins for stop / drivable / occupancy:** rejected — they are honest approximations of what Node/Group can show today, labeled as such in sample descriptions.

## Consequences

- Nine ADAS samples load; six remain reserved for missing path / FOV / trajectory primitives.
- Parking slots are axis-aligned only (rotate handles are still deferred on the engine).
- Engine protocol unchanged; reserved demos flip to loadable when matching primitives land.

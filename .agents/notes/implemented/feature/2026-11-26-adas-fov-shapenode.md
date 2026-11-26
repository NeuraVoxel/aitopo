# Agent Note: ADAS FOV sample (ShapeNode sectors)

Status: implemented

## Problem

ADAS catalog kept a reserved **Sensor FOV** row waiting on sector / frustum overlays. After `GraphShapeNode` shipped, camera / radar / lidar wedges can be honest closed polygons without a dedicated frustum primitive, but the catalog still blocked the row and the title still said Sensor FOV.

## Decision

Ship a loadable ADAS sample:

| Field | Value |
|---|---|
| id | `adas-fov` (replaces reserved `adas-sensor-fov`) |
| title | **FOV** |
| geometry | closed `GraphShapeNode` sectors (origin + arc) around axle-frame ego |
| sensors | lidar 270° / radar 120° / camera 60° (forward = screen up) |
| follow | mount nodes `followHostId` → ego; FOV wedges `followHostId` → their mount |
| chrome | `ADAS_*` theme tokens + `style.alpha` (+ select/hover alpha) |
| layers | `sensors` under `agents` |

Delete `demo/samples/adas/placeholders.ts` — ADAS has no reserved rows. Catalog order ownership stays in [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md).

## Alternatives considered

- **Keep id `adas-sensor-fov` and only rename the title:** rejected — the product name is FOV; a shorter id matches the catalog label and avoids a permanent “sensor-” leftover.
- **Wait for a native frustum / cone overlay:** rejected — ShapeNode sectors already show the BEV FOV story; a later frustum can replace points without a second catalog row.
- **Draw FOV as `GraphPath`:** rejected — Path is not a node; wedges need fill + select/drag as ShapeNode (see [graph-shape-node](2026-11-26-graph-shape-node.md)).

## Consequences

- ADAS FOV row is loadable; OEM mount comparison lives on `adas-sensor` ([2026-11-26-adas-sensor-oem-schemes.md](2026-11-26-adas-sensor-oem-schemes.md)).
- Registry no longer expects an ADAS reserved stub.
- Theme hex gate covers `fov.ts` like other ADAS samples.
- Sector geometry shared via `demo/samples/adas/sector.ts`.

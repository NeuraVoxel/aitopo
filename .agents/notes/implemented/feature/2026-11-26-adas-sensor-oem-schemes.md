# Agent Note: ADAS Sensor OEM scheme demo

Status: implemented

## Problem

ADAS already shows generic FOV wedges (`adas-fov`) but not how mainstream stacks place sensors on the ego. Contributors comparing Tesla / XPeng / IM / Huawei / robotaxi packages had no catalog row for side-by-side mount layouts.

## Decision

Add loadable sample `adas-sensor` (title **Sensor**), ordered after FOV:

| Scheme | Tagline sketch |
|---|---|
| Tesla | Vision-first cameras (+ front radar marker) |
| XPeng | Roof lidar + cams + corner radars |
| IM (智己) | Roof lidar stack + USS markers |
| Huawei | Dense ADS cams/radars + front lidar |
| Xiaomi (小米) | SU7-style roof lidar + cams/radars/USS |
| Waymo | Robotaxi dome + secondary lidars |

One document, **six axle-frame egos** in a 3×2 grid. Each car carries mount markers (`C`/`R`/`L`/`U`) and faint `GraphShapeNode` FOV sectors. Follow chain: mounts `followHostId` → ego; FOV wedges `followHostId` → their mount (same contract as FOV demo). Layouts are **public schematic sketches**, not official calibration. Shared sector helper: `demo/samples/adas/sector.ts` (also used by FOV). Chrome via `ADAS_*` only. Catalog membership: [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md).

## Alternatives considered

- **One ego with a scheme switcher:** rejected — catalog samples remount whole documents; side-by-side comparison is the product ask.
- **Mounts only (no FOV wedges):** rejected — partner chose mounts + simplified wedges; FOV demo stays the deep single-car FOV study.
- **Separate sample per OEM:** rejected — one comparison story should not multiply nav rows.

## Consequences

- ADAS Sensor row sits after FOV in the eight-row ADAS catalog (see [demo-adas-group](2026-11-25-demo-adas-group.md)).
- Sensor counts / positions may lag real OEM revisions; descriptions must keep the schematic disclaimer.

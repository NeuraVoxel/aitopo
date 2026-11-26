# Agent Note: ADAS catalog trim (stop / traffic / parking / HD map)

Status: implemented

## Problem

The ADAS demo group carried four loadable rows that no longer earn catalog space: stop & crosswalk AABB stand-ins, traffic signals chrome, axis-aligned parking slots, and an HD map junction sketch. They diluted the core BEV story (ego / agent / static / lane / OCC) without exercising unique engine contracts beyond what those rows already show.

## Decision

Remove these demo samples from the ADAS catalog and delete their modules:

| Removed id | Former title |
|---|---|
| `adas-stop-crosswalk` | Stop & crosswalk |
| `adas-traffic-signals` | Traffic signals |
| `adas-parking-slots` | Parking slots |
| `adas-hdmap-junction` | HD map junction |

`demo/samples/adas/index.ts` keeps order for the surviving core rows (ego → agent → static → lane → OCC); FOV later lands as a separate loadable sample ([2026-11-26-adas-fov-shapenode.md](../feature/2026-11-26-adas-fov-shapenode.md)). Theme tokens and remaining samples stay owned by [2026-11-25-demo-adas-group.md](../feature/2026-11-25-demo-adas-group.md) and [2026-11-26-adas-foxglove-theme.md](../feature/2026-11-26-adas-foxglove-theme.md).

## Alternatives considered

- **Keep the four rows as reserved stubs:** rejected — reserved ids are for missing engine primitives; these rows were already loadable and are being dropped, not deferred.
- **Fold their scenes into Lane / Agent:** rejected — would bloat those samples without a shared narrative; trim is clearer than merge.
- **Leave files on disk but unregister:** rejected — dead modules drift and still trip the ADAS hex gate.

## Consequences

- Catalog trim removes stop/crosswalk, traffic signals, parking slots, and HD map junction from ADAS nav.
- Registry assertions and README catalog copy match the trimmed set (FOV ownership is separate).

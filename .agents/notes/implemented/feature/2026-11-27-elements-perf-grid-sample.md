# Agent Note: Elements Perf grid sample

Status: implemented

## Problem

ADAS OCC doubled as a BEV occupancy showcase and the engine’s 4k-node paint/hit/select stress path. That mixed domain teaching with performance knobs (`expandPartialDirty: false`, dense chrome, 80×50 cells) and made OCC look broken under select-all lazy drag.

## Decision

- **OCC** stays an ADAS occupancy sample (ego-centric perception frame — [OCC realism](./2026-11-27-occ-ego-centric-perception.md)). No stress opt-outs.
- **`elements-perf-grid` (title Perf)** under Elements owns engine stress: 80×50 plain GraphNodes, empty labels, dense chrome, `expandPartialDirty: false`. Bulk select-all drag tests target this sample.

## Alternatives considered

- **Keep 4k OCC and add a separate Perf sample:** rejected — OCC would still teach the wrong “nodes don’t move while dragging” lesson for an ADAS map.
- **Put Perf under ADAS:** rejected — stress is not occupancy semantics; Elements is the catalog home for engine primitives and harnesses.

## Consequences

- Catalog: Perf after SubNetwork in Elements; OCC description no longer says paint stress.
- Tests: `tests/perf-select-all-drag.spec.ts`; registry asserts OCC kinds and Perf cell count / expand off.
- Related: [ADAS group](./2026-11-25-demo-adas-group.md), [expand default on](../architecture/2026-11-27-expand-partial-dirty-default-on.md), [OCC select-all hang](../bug-fix/2026-11-27-occ-select-all-drag-hang.md).

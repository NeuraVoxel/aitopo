# Agent Note: Elements Perf grid sample

Status: implemented

## Problem

ADAS OCC 同时承担 BEV 占用网格展示和引擎 4k 节点 paint/hit/select 压测。领域教学与性能旋钮（`expandPartialDirty: false`、稠密 chrome、80×50）混在一起，全选 lazy 拖时 OCC 看起来像坏了。

## Decision

- **OCC** 只做 ADAS 占用样例（自车中心感知帧 — [OCC realism](./2026-11-27-occ-ego-centric-perception.md)）；不再带压测 opt-out。
- **Elements 下 `elements-perf-grid`（标题 Perf）** 专管引擎压力：80×50 普通 GraphNode、空 label、稠密 chrome、`expandPartialDirty: false`。全选拖拽压测挂这个样例。

## Alternatives considered

- **OCC 仍 4k，另加 Perf：** 否决 — OCC 仍会教错「ADAS 地图拖着格子不跟着动」。
- **Perf 放 ADAS：** 否决 — 压测不是占用语义；Elements 才是引擎原语 / 压测样例的目录。

## Consequences

- 目录：Perf 在 Elements 的 SubNetwork 之后；OCC 说明不再写 paint stress。
- 测试：`tests/perf-select-all-drag.spec.ts`；registry 断言 OCC 种类与 Perf 格数 / expand 关。
- 相关：[ADAS group](./2026-11-25-demo-adas-group.md)、[expand default on](../architecture/2026-11-27-expand-partial-dirty-default-on.md)、[OCC select-all hang](../bug-fix/2026-11-27-occ-select-all-drag-hang.md)。

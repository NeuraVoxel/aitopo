# Agent Note: OCC select-all drag hang

Status: implemented

## Problem

ADAS OCC（约 4k occupancy GraphNode）在全选单元格后拖拽会卡死页面。每次 `pointermove` 对每个选中 id 各调一次 `previewNodePosition`；每次调用都重建 follow-host 索引（`listTransitiveFollowers` / `translateFollowersLive` 扫全节点表）并跑 `validateDirty`。即便没有 follow 边，单次移动成本也约 O(N²)。

## Decision

1. **批量 preview** — GestureEditor / Network 提供 `previewNodePositions`；`MoveNodeInteraction` 每帧只发一批。一次 `writePositions`、一次 follower 索引、一次 `validateDirty`、一次 schedule。批量大于 `MAX_PARTIAL_DIRTY_ABSORBS` 时用 `dirty.markAll()`，不再逐 mover 采 rect。
2. **write 路径共享 follow 索引** — `translateHostMovesLive` 在每次 `writePositions` / `writeBounds` / `writeGroupPositions` 批次中只建一次 host→followers；空索引直接短路。
3. **批量 UI 上限（`BULK_SELECTION_UI_CAP` = 64）** — movers/selection 超限时：强制 lazy 拖（不 live write/validate）、一个并集 AABB ghost、overlay 上一个并集选中框（非 N 个 ring）、`commitNodeMoves` 单次 GraphPatch、`syncDirtyFromScene` 走 `markAll`、跳过 N× `nodeMoved`。

## Alternatives considered

- **只做批量 live preview：** 不够 — OCC 仍会在每帧 N 个 selection ring、以及 pointer-up 时 N× `commitNodeMove` / dirty 捕获上卡死。
- **空间索引 / 跳过 validateDirty：** 推迟 — bulk 规模下改 lazy 即可；hit 仍见 roadmap Wave M。
- **压力样例限制选择数量：** 否决 — 引擎须扛住 bulk 选择；卡死是引擎缺陷（压测目录现为 Elements **Perf**）。

## Consequences

- 低于 cap 的多选仍 live preview；超过则 lazy + 批量 commit。
- 单节点 preview 仍走原路径（长度为 1 的 batch）。
- 全选拖拽时间预算现挂 Elements **Perf**（`tests/perf-select-all-drag.spec.ts`）；OCC 只做 ADAS 占用样例（[perf grid](../feature/2026-11-27-elements-perf-grid-sample.md)）。
- 批量 commit 后 pointer-up 假死（apply/invert/`PatchHistory`）见 [OCC select-all commit release](2026-11-27-occ-select-all-commit-release.md)。


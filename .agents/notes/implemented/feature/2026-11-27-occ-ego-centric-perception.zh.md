# Agent Note: OCC ego-centric perception sample

Status: implemented

## Problem

把压测拆到 Elements **Perf** 之后，OCC 仍像以自车为中心的装饰性 free/occupied/unknown 棋盘，而不像感知栈吐出的 BEV 占用帧（量程边缘、遮挡阴影、米制格子、上层检测框）。

## Decision

将 `adas-occupancy-bev` 重做成 **自车中心的感知快照**：

- 约 0.5 m 格（`CELL_M` × `PX_PER_M`），自车靠底边居中朝前。
- 占用块按米制：路缘 / 路边车 / 前车 / 行人。
- 传感范围 / FOV 外，以及被占用格挡住的射线后为 unknown；FOV 内其余为 free。
- 图层 `occupancy`（不可移动）+ `agents`；Vehicle / Ped 检测框与中轴 Ego 在 `agents`。

引擎压测仍归 [Elements Perf](./2026-11-27-elements-perf-grid-sample.md)。

## Alternatives considered

- **保留抽象盐粒+方块格：** 否决 — 产品要求贴近真实检测 OCC。
- **完整激光仿真 / 对数几率栅格：** 否决 — 这是 demo 保真度，不是感知栈；AABB + Bresenham 遮挡足够读懂。
- **只有占用格、无检测框：** 偏弱 — 融合 BEV UI 通常在格子上叠 track。

## Consequences

- 目录说明与 registry 断言图层、三种 occupancy、以及 `det-*` 覆盖层。
- occupancy 层 `movable: false`，宿主尊重图层时全选地图不会默认 bulk 拖走每一格。

# Agent Note: Debug OBB / AABB overlay

Status: implemented

## Problem

工具栏 Debug 原先只描 dirty 并集。排查 paint pad、旋转与 attachment 布局时，需要贴近 twaver 的逐元素包围盒：宿主内画 OBB，最后再画统一 AABB，且每个 attachment 区域都要描出——不能只画一个节点 AABB。

## Decision

`debugPaintRects` 开启时（demo **Debug**），每次 validate 绘制：

1. **定向部件（有角度即为 OBB）：** body/band/path/shape 以及每个 attachment 的 `bounds`，在宿主空间绕 pivot 旋转描边（`lineWidth = 1 / zoom`）。
2. **最终 AABB：** geometry 并集与 paint 外延（视图同时暴露两者时），在 OBB 之后轴对齐描边。
3. **Dirty 并集：** `endFrame` 中的红色描边不变。

视图提供 `debugBounds()`；`Network` 在 `endFrame` 前收集并交给 `Renderer.drawDebugElementBounds`。颜色集中在 `src/render/debug-bounds.ts`（洁室色板，不用 twaver API 名）。

## Alternatives considered

- **只描整节点旋转后的 AABB：** 否决 — 看不到 attachment 布局，也不符合 twaver「内 OBB、外 AABB」的读法。
- **Dirty 与元素包围盒分两个 Debug 模式：** 否决 — 现有 Debug 开关已够；无产品需求时不叠 UI。
- **Attachment 直接用世界 AABB、不跟宿主旋转：** 否决 — attachment 写在未旋转宿主空间；OBB 必须共用宿主 angle/pivot。

## Consequences

- 打开 Debug 可见橙色 body OBB、灰色 attachment OBB、绿色 geometry AABB、青色 paint AABB、红色 dirty 并集。
- 无头 / fake renderer 可省略 `drawDebugElementBounds`；方法缺失时 Network 不强制调用。
- 相关 dirty 足迹：[view paintBounds dirty](../architecture/2026-11-27-view-paint-bounds-dirty.md)。

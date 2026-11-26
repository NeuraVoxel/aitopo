# Agent Note: View stats HUD and dense-paint quick wins

Status: implemented

## Problem

密集 ADAS OCC（约 4k GraphNode）在平移 / 悬停时卡顿。同时压测时需要画布上直接看到 zoom 与绘制负载。twaver 只有滚轮时的临时 Zoom 提示，没有常驻 HUD 或 FPS。

## Decision

- **View stats HUD：** Network 默认在右上角挂 HTML 叠层（`Zoom x.xx` / `FPS n`；`viewStatsVisible: false` 关闭）。FPS 为连续 rAF 节拍（页签前台时接近屏幕刷新率），约每秒刷新一次。
- **`style.shadow: null`：** 显式 `null` 关闭节点默认 drop shadow（Group 本无默认）。OCC 格子使用此项，未选中时跳过 Canvas `shadowBlur`。
- **Hover 短路：** `setHover` 在 id 未变时直接返回。
- **Overlay 绘制：** 仅对选中 / 悬停的 node、group 调用 `toPaintView`（不再扫全表）。
- **视口裁剪：** 场景绘制跳过与相机世界矩形（含 padding）不相交的元素，含全帧 `'all'`。仅在视图 CSS 尺寸真实（`width`/`height` > 1）时启用；布局前的 1×1 默认跳过裁剪，避免宿主/测试空白。

## Alternatives considered

- **照搬 twaver 临时 zoomDiv + Reset：** 否决 — 产品要常驻右上角 Zoom + FPS；clean-room HUD，不抄 API 名。
- **仅统计 `validate()` 的绘制 FPS：** 产品否决 — 空闲时像“不动就是 0”；常驻 HUD 应显示 rAF/屏幕刷新上限，重绘卡顿时数值自然下降。
- **全局关掉节点默认 shadow：** 否决 — 会改掉所有图的观感；用 `null` 显式退出。
- **本变更做空间 hit 索引 / dirty 洪水上限：** 延后 — 先做 hover 短路、overlay 精画、视口裁剪与 shadow 退出；索引与 expandPartialDirty 封顶仍属路线图。

## Consequences

- 协议允许 node/group style 的 `shadow: null`；invert/clone 保留 null。
- `elementPaintPad` 在 paint DTO 无 shadow 时不再臆造默认 blur — 调用方须转发已解析的 paint shadow（含节点默认 shadow）。
- OCC demo 为每个 occupancy 格子写入 `shadow: null`。
- 测试覆盖 parse/null shadow、hover 短路、视口裁剪、HUD 显隐，以及 NodeView 默认 vs null。

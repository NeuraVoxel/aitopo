# Agent Note: expandPartialDirty defaults on

Status: implemented

## Problem

[expandPartialDirty opt-in](./2026-11-27-expand-partial-dirty-opt-in.md) 把邻居洪水默认关掉，好让 OCC 规模绘制跳过 O(n) expand。代价是普通稀疏编辑会出现 AA / 阴影 / 旋转墨迹接缝，除非每个宿主都记得打开开关。产品偏好是默认无残影 partial；只有稠密压力路径才应关掉。

## Decision

`NetworkOptions.expandPartialDirty` 默认 **`true`**（`options.expandPartialDirty !== false`）。稠密压测宿主需要仅 AA grow 时传 **`false`**。Demo：属性面板勾选默认开；Elements **Perf**（`elements-perf-grid`）挂载时设 `DemoSample.expandPartialDirty: false`。取代 opt-in 笔记中的默认关选择；开关 API 本身保留。

## Alternatives considered

- **继续默认关：** 否决 — 稀疏编辑残影是常见路径；稠密宿主可以显式声明例外。
- **仅在超过 `BULK_SELECTION_UI_CAP` 时自动关：** 推迟 — 以后仍有用，但样例/宿主传 `false` 已够 OCC，且开关保持显式。

## Consequences

- 除非宿主显式关掉，否则跑邻居洪水；断言仅 AA grow 的测试传 `expandPartialDirty: false`。
- Perf Demo 经样例元数据加载时 expand 为关；离开 Perf 恢复默认开（[perf grid](../feature/2026-11-27-elements-perf-grid-sample.md)）。
- 交叉引用：[opt-in 开关](./2026-11-27-expand-partial-dirty-opt-in.md)、[neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md)、[flood cap](./2026-11-27-partial-dirty-flood-cap.md)。

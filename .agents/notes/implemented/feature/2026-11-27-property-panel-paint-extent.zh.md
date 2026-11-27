# Agent Note: Property panel paint-extent controls

Status: implemented

## Problem

Debug 叠层能看出 geometry AABB 与更大的 paint AABB，但 demo 属性面板原先只能改 selection glow。`paintExtentGrow` 的投影输入（`blur`、offsets）只能改文档 JSON，调青色 paint 足迹不方便。

## Decision

Demo 属性面板（node/group）暴露：

- `shadow` 开关 → `style.shadow: null` 或 shadow 对象
- `shadow blur` / `shadow ox` / `shadow oy` / `shadow color` → `style.shadow.*`
- 既有 `select glow` / `glow blur` 继续驱动 `paintExtentGrow` 的 glow 一侧

引擎公式余量具名为导出常量（`PAINT_SHADOW_EXTENT_PAD`、`PAINT_GLOW_EXTENT_PAD`、`DEFAULT_GLOW_BLUR`、`DEFAULT_NODE_SHADOW`），shadow 外延计入 `|offsetX|`。pad 覆盖只作为 `paintExtentGrow` 参数供测试/工具，不进协议字段。

## Alternatives considered

- **把 +2/+4 pad 做成 GraphDocument style 字段：** 否决 — 那是引擎软边余量，不是作者样式；面板调墨水参数即可。
- **只在 Network Debug 层做 pad 滑条：** 否决 — 需求落在属性面板；逐元素 shadow/glow 已有协议位。
- **shadow 继续只靠 `data` JSON 编辑：** 否决 — 无法在 Debug 叠层旁直接拧 paint 外延。

## Consequences

- 关掉 shadow 或减小 blur/glow 会缩小青色 `paintBounds`（该元素作 seed 时红框随之变小）。
- 节点在省略 `style.shadow` 时从 `DEFAULT_NODE_SHADOW` 合并写入；group 从 `{}` 起步。
- 相关 bake 策略：[view paintBounds dirty](../architecture/2026-11-27-view-paint-bounds-dirty.md)。

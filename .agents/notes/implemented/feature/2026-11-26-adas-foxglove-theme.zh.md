# Agent Note: ADAS Foxglove theme

Status: implemented

## Problem

ADAS demo 此前只能走 nuBoard 色板。贡献者还想要 Foxglove Studio 风格（foxglove.dev 品牌紫 + 深色中性色），又不想为每个样例分叉，也不想在样例里手写 hex。

## Decision

ADAS 色值统一经 `demo/lib/adas-theme.ts`（`ADAS_*` getter）。已注册色板共用同一 token 形状：

| Theme id | Palette module | Role |
|---|---|---|
| `nuboard`（默认） | `demo/lib/nuplan-palette.ts` | motional/nuplan-devkit `nuboard/style.py` |
| `foxglove` | `demo/lib/foxglove-palette.ts` | foxglove.dev 品牌紫 `#a56eff` + studio 中性色 |
| `rviz` | `demo/lib/rviz-palette.ts` | 经典 RViz 默认（背景 `#303030`、网格 `#a0a0a4`、TF RGB / map unknown `#708986`） |

`setAdasTheme` / `getAdasTheme` 管理当前主题。`ADAS_THEME_OPTIONS` 是工具栏目录（以后加风格时往这里追加）。ADAS 样例文档在访问时重建（`get document()` → `build…Document()`）。当前样例属于 `adas` 组时，工具栏显示 **Theme** 下拉；切换会 remount network。`tests/adas-nuboard-palette.spec.ts` 用已注册色板的并集门禁 `demo/samples/adas/` 下的裸 hex。目录归属仍见 [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md)。

## Alternatives considered

- **用 Foxglove 完全替换 nuBoard：** 否决 — nuBoard 仍为默认；Foxglove 为可选。
- **只加 Foxglove 模块但不接线：** 否决 — 没有 facade + 工具栏 remount，主题到不了样例。
- **按主题复制整套 ADAS 样例：** 否决 — 目录噪音翻倍；facade + 惰性文档保持单一 sample id。
- **样例继续直接 import `NUPLAN_*`：** 否决 — 没有 `ADAS_*` 间接层就无法在切换主题时重建文档。

## Consequences

- 新 ADAS 样例只从 `adas-theme.ts` 引入 `ADAS_*`，禁止裸 hex，也禁止直接依赖色板文件。
- Vector ego chrome（`demo/lib/vector-images.ts`）与 ego pulse 路径在绘制/更新时读 `ADAS_*`。
- 默认主题在会话内保持 `nuboard`，直到工具栏切换。

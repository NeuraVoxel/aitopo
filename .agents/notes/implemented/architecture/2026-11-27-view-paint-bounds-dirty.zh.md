# Agent Note: Bake paint extents into View bounds for dirty seeds

Status: implemented

## Problem

单元素 dirty seed 被膨胀了两次：View 存几何 union 后，Network / GestureEditor 再套 `elementPaintPad`（至少 8，选中时常 glow ~20）以及边/路径上盲目的 `+8`。这比 twaver 的 `getZoomViewRect`（validate 时把 shadow/glow 烘焙进 body+attachments，再 Network `grow(2,2)`）大得多。

## Decision

按 twaver.vector 思路收紧单元素 footprint（clean-room 命名）：

1. **在 View validate 烘焙 extent** — Node/Group 提供 `paintBounds` = 几何 `bounds` 经 `paintExtentGrow`（`blur + |offsetX| + |offsetY| + PAINT_SHADOW_EXTENT_PAD` 与 `glowBlur + PAINT_GLOW_EXTENT_PAD` 取 max；最坏 selection glow）扩大。Edge/Path/ShapeNode 把 stroke（以及边的 arrow size）烘焙进 path AABB；`paintBounds` 即该盒。Demo 属性面板暴露 node/group 的 `style.shadow` 与 `style.select.glow*`，可现场拧青色 paint AABB（见 [property panel paint extent](../feature/2026-11-27-property-panel-paint-extent.md)）。
2. **Dirty 捕获用 `view.paintBounds`** — apply sync、preview capture、selection/hover dirty、对端 seed、draw cull、以及 `expandPartialDirty` 吸收均用 `paintBounds`，不再二次 pad。
3. **最终 AA grow** — `expandPartialDirty` 对 seed 一次性 `DIRTY_SEED_AA_GROW`（2），对齐 twaver 的 union grow。

**保留**对端整身 seed 与邻居洪水 expand（+ absorb cap）。本变更不做 multi-rect、不做 lift-to-overlay。

Hit / layout 仍用几何 `bounds`（旋转时还有 `originalUnionBounds`）。Dirty / paint cull 用 `paintBounds`。

## Alternatives considered

- **去掉对端 + expand（完全对齐 twaver invalidate 集合）：** 本切片否决 — 残影策略不动，只收紧单元素 footprint（选项 A）。
- **继续在每个 capture 点用 `elementPaintPad`：** 否决 — 与已烘焙的 View.bounds 重复计算。
- **仅在当前选中时烘焙 glow：** 否决 — selection chrome 画在 root；bounds 用最坏 glow，避免 selection 切换时再靠第二套 pad。

## Consequences

- 单独 / 稀疏编辑的 dirty 洞更紧（body + 烘焙 shadow/glow + 2px）。
- 有连边的移动仍经 incident 边、对端与 expand 放大（策略不变）。
- `elementPaintPad` 保留为带 min-8 的遗留助手；新代码用 `paintExtentGrow` + 烘焙 bounds。
- 曾假定 dirty union 另含 Network +8 的宿主会看到略小的 partial clip（仍覆盖 paint 墨迹）。

## Testing

- `tests/paint-channels.spec.ts` — 单节点 preview dirty 贴近 body+AA grow；far-endpoint、neighbor-expand、absorb-cap 用例保留。

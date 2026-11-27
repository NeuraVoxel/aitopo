# Agent Note: Partial dirty absorb cap

Status: implemented

## Problem

拖动单个节点时，live preview 常常付出接近全图重绘的代价。Preview seed 已并上 mover、incident edge AABB 与对端；`expandPartialDirty` 再把每个相交元素的**完整** padded bounds 洪水并入 seed。长边走廊吸收高邻居，再吸收更多兄弟，直到 dirty 洞（以及 draw cull）几乎盖住全部元素——表面上仍是 “partial” rect。

## Decision

**吸收上限 → `'all'`** — `expandPartialDirty` 运行时（默认**开**——[defaults on](./2026-11-27-expand-partial-dirty-default-on.md)；开关见 [expand opt-in](./2026-11-27-expand-partial-dirty-opt-in.md)），吸收超过 `MAX_PARTIAL_DIRTY_ABSORBS`（24）个元素则返回 `'all'`，不再生成雪崩 union。限制稠密重叠链上的 while 循环成本，并把「实质全帧」说清楚。

Preview 始终跑 expand（与 apply / selection 相同）。此前的 preview skip-expand 因残影安全已撤回 — 见 [preview skip-expand withdrawn](../bug-fix/2026-11-27-preview-skip-expand-withdrawn.zh.md)。

不改 Document / Patch / Events。多 rect dirty 与 drag-filter 全帧收窄仍属 [performance roadmap](../../proposed/architecture/2026-09-11-performance-roadmap.md) 后续 Wave K。Lift-to-overlay 拖拽为单独跟进。

部分取代 [neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md) 的无界洪水后果：仍 expand，但有硬吸收上限。Preview 的对端 seed 不变（[far-endpoint residual](../bug-fix/2026-11-20-far-endpoint-dirty-residual.md)）。

## Alternatives considered

- **只加大 pad / 缩小 edge AABB：** 否决 — 挡不住走廊上重叠 body 的洪水增长。
- **整段删除 `expandPartialDirty`：** 否决 — apply / 脉冲 / preview 仍需整邻居清除以消灭 AA / 旋转墨迹接缝。
- **有连边的 preview 一律 `markAll`：** 否决 — 吸收未超 cap 时稀疏图会丢掉局部 clip。
- **本变更做 multi-rect dirty：** 否决 — 更大的 Wave K；先落地 absorb cap。
- **Preview skip-expand（仅 seed dirty）：** 尝试后撤回 — 无 expand 时 clear 打穿邻居会留残影（[withdrawal](../bug-fix/2026-11-27-preview-skip-expand-withdrawn.zh.md)）。

## Consequences

- 会吸收 >24 个邻居的稠密 expand 链改为 `'all'`，不再给出巨型 partial rect。
- Preview 与 apply 都 expand；未超 cap 时稀疏图拖拽保留 partial clip。
- `debugPaintStats`（Wave J）仍延后；吸收次数有测试覆盖，尚未进 HUD。

## Testing

- `tests/paint-channels.spec.ts` — apply 重叠链超 cap → `'all'`；既有 neighbor-expand 与 far-endpoint 用例保留。

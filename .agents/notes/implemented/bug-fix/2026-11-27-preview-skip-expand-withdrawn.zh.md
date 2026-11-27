# Agent Note: Withdraw preview skip-expand (restore residual safety)

Status: implemented

## Problem

[Partial dirty flood cap](../architecture/2026-11-27-partial-dirty-flood-cap.zh.md) 在 live preview 上跳过了 `expandPartialDirty`，以免拖拽把 dirty 洞雪崩放大。seed（mover ∪ edge AABB ∪ 对端）仍会对相交邻居 `clearRect`；没有邻居扩张时，这些邻居只在 clip 内重画，AA / shadow / 旋转墨迹会留下残影——正是 [neighbor expand](./2026-11-26-partial-dirty-neighbor-expand.md) 与 [far-endpoint residual](./2026-11-20-far-endpoint-dirty-residual.md) 修过的那类缺陷。

## Decision

撤回 preview skip-expand。`GestureEditor` preview 路径重新走普通 scene paint，因而会跑 `expandPartialDirty`。flood-cap 笔记中的吸收上限（`MAX_PARTIAL_DIRTY_ABSORBS` → `'all'`）**保留**。删除已无用的 `expandDirtyNeighbors` 调度开关。

不改 Document / Patch / Events。Lift-to-overlay 拖拽（冻结 root、overlay 上 live movers）仍是后续性能跟进，不在本修复内。

取代 [partial dirty flood cap](../architecture/2026-11-27-partial-dirty-flood-cap.zh.md) 的决策第 1 条（preview skip-expand）；第 2 条（absorb cap）不变。

## Alternatives considered

- **保留 skip-expand、容忍残影：** 否决 — 每次 live 拖拽都会在重叠 / 走廊邻居上看到幽灵。
- **Preview 仅做 depth-1 expand：** 本修复否决 — 仍会把 clear 洞扩到整段一跳 bounds；残影安全若离开已知的全量 expand 路径，需要比回归补丁更多的证明。
- **本变更做 lift-to-overlay：** 否决 — 长期拖拽成本模型正确，但大于「恢复 expand + cap」的架构面。

## Consequences

- Live preview 再次把相交邻居扩进 dirty 洞（吸收超过 cap 时可为 `'all'`）。
- 稠密重叠图上的拖拽 preview 可能全帧；稀疏图保留 partial clip 且 clear 正确。
- 宿主不再遇到 flood-cap preview 路径带来的 skip-expand 接缝回归。

## Testing

- `tests/paint-channels.spec.ts` — 保留 absorb-cap → `'all'`；删除 skip-expand 走廊断言；far-endpoint 与 overlapping-neighbor expand 用例保留。

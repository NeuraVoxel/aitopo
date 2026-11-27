# Agent Note: OCC select-all commit blocks pointer release

Status: implemented

## Problem

在 [OCC select-all drag hang](2026-11-27-occ-select-all-drag-hang.md) 修好 preview 路径之后，OCC Demo 全选（约 4k 格）拖拽松手仍会卡住：页面一直占着 pointer capture / lazy chrome，像移动没结束。Edit 模式更严重——`PatchHistory.pushAndApply` 走 `invertPatch`，对每个 op 各调一次 `applyPatch`（每次 `structuredClone`），invert 本身就是 O(N×clone)，指针抬起回调根本回不来。

## Decision

1. **`applyPatch` 的 updateNode 批量路径** — 展开后若全是 `updateNode`，按 id 合并 patch，一次 O(nodes + ops) 重写 nodes 数组（不做逐 op 的 `findIndex`/`slice`，也不整表 `structuredClone`）。
2. **`invertPatch` 的独立 updateNode 批量路径** — 若每个 op 都是对不同 id 的 `updateNode`，用 apply 前的节点 id 表倒序求逆；id 重复或夹杂其他 op 种类时仍走原来的逐 op apply 路径。
3. **`MoveNodeInteraction` pointer-up 用 `try`/`finally`** — 拖拽结束后无论 commit 是否抛错，都执行 `clearPaintFilter`、清 lazy chrome、`releasePointerCapture`、`reset`。

## Alternatives considered

- **批量 commit 跳过 history：** 只能救 observe 宿主；Edit 模式仍要能撤销全选移动。
- **`writePositions` 绕过 GraphPatch 提交：** 更快，但丢掉 zod 校验与 history invert；批量 apply/invert 仍保持同一契约。
- **只加 `try`/`finally`、不加速 apply/invert：** capture 能放开，但主线程仍会卡数秒到数分钟，界面照样假死。

## Consequences

- 全选拖拽 commit（无论是否包 `PatchHistory`）保持可交互；即便 commit 报错也会放下 pointer capture。
- 测试：`tests/perf-select-all-drag.spec.ts`（Elements Perf 上 history 包裹的 commit 时间预算）、`tests/patch.spec.ts` / `tests/patch-history.spec.ts`（批量 apply/invert 预算）、`tests/move-node.spec.ts`（commit 抛错仍释放 capture）。
- 混合 patch、以及同一 id 多次 `updateNode` 的序列仍走慢 invert 路径。

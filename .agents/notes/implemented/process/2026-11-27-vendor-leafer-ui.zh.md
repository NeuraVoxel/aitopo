# Agent Note: Vendor LeaferUI canvas reference

Status: implemented

## Problem

Canvas / 无限画布 UI 模式（场景图、编辑工具、稠密绘制）在 twaver 与产品 UX vendor 之外没有可检入的对等树。Agent 只能临时去翻 LeaferJS。

## Decision

在 `vendor/leafer-ui` 增加浅克隆 submodule → https://github.com/leaferjs/leafer-ui.git（`.gitmodules` 设 `shallow = true`）。仅作设计参考：画布 UI / 性能思路，不是 workspace 包。`src/` 与 `demo/` 不得 import，也不得把 Leafer 公开 API 名抄进引擎。登记于 [vendor/README.md](../../../vendor/README.md) 与 [AGENTS.md](../../../AGENTS.md)。与 [vendor 产品级参考](2026-11-20-vendor-product-references.md)（产品 UX）及本地 twaver（引擎绘制/交互权威）互补。

## Alternatives considered

- **npm-link / workspace 包：** 否决 — 会把 clean-room 引擎绑到 Leafer API。
- **只写 URL：** 否决 — Agent 需要与其他 vendor 并列的本地树。
- **就地拓宽产品 UX vendor 笔记：** 否决 — Leafer 是画布引擎对等参考，不是产品编撰 UX；单独 process 笔记才能保持权威切分清晰。

## Consequences

- 新克隆：`git submodule update --init --depth 1 vendor/leafer-ui`。
- 引擎提案可引用 Leafer 的画布思路；脏区绘制 / 交互 / chrome 仍以 twaver 为准。

## Testing

- `git submodule status` 列出 `vendor/leafer-ui`。
- `pnpm run verify-notes`。

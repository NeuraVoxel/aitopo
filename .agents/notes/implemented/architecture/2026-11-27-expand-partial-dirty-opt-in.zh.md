# Agent Note: expandPartialDirty is opt-in (default off)

Status: implemented

## Problem

每次 partial paint，`expandPartialDirty` 都会扫全图以洪水吸收相交邻居。稠密图（OCC 多选、大 dirty seed）下，即便 host 已对 mover 做批量 lazy，每帧仍付 O(n) expand 成本，压力路径并不需要邻居接缝修复。

## Decision

用 `NetworkOptions.expandPartialDirty`（及 `setExpandPartialDirty`）开关洪水。**默认现为 `true`** — 见 [expandPartialDirty defaults on](./2026-11-27-expand-partial-dirty-default-on.md)，它取代下文的默认关选择。开关本身保留：**`false`** 只做 `growRect(seed, DIRTY_SEED_AA_GROW)`；**`true`** 跑邻居并集 + 吸收上限 → `'all'`。seed 仍用烘焙的 `paintBounds`；远对端 seed 在对应路径上照旧。

## Alternatives considered

- **整段删除 expand：** 否决 — ADAS pulse / 重叠 chrome 仍需 expand 路径才能无残影清洞（[neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md)）。
- **默认开、仅 bulk 以上关掉：** 本笔记默认关时记为否决；后由 [defaults on](./2026-11-27-expand-partial-dirty-default-on.md) 取代（稠密路径由样例/宿主传 `false`）。

## Consequences

- 开关 API 保留；默认与 Demo 接线以 [defaults on](./2026-11-27-expand-partial-dirty-default-on.md) 为准。
- 相关：[partial dirty absorb cap](./2026-11-27-partial-dirty-flood-cap.md)、[view paintBounds dirty](./2026-11-27-view-paint-bounds-dirty.md)。

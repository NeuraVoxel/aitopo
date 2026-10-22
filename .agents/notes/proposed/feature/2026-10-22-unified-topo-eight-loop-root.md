# Agent Note: Unified topo — eight-loop root (phase 1 migrate)

Status: proposed

## Problem

智驾闭环现有三张独立 topo（业务八环节环、湖仓骨架 × 挖掘大脑、四段六步数据流）无法在同一画布多层下钻浏览。需要在笔记侧 `…/数据闭环/架构设计` 落一张整体 topo；第一阶段必须先把业务八环节环迁为根画布，且不破坏原笔记目录中的源图。

## Proposal

### Scope (phase 1 only)

- Root canvas = 业务八环节环（option A).
- Deliver under:
  `/Users/macff/Documents/Jeff/notes/02-Tech/03-自动驾驶/03-数据闭环/架构设计/智驾数据闭环-整体-topo/`
  with `diagram.graph.json`, `diagram.html`, `host.js`, `aitopo.iife.js`.
- Copy geometry / nodes / edges / placeholder `networks` from
  `…/小周谈智驾闭环/智驾数据闭环-八环节-topo/`; do not merge the other two diagrams yet.
- Host + IIFE from current topo-diagram skill assets (includes boot anti-flicker).
- Leave source eight-loop topo in the notes folder untouched.

### Meta / chrome

| Field | Value |
|---|---|
| title | `智驾数据闭环 · 整体架构` |
| eyebrow | `Architecture · 八环节为根` |
| kind | `topology` |
| source | `智驾数据闭环-八环节-topo` |
| summary | 八环节环为根画布；站点 SubNetwork 后续挂湖仓/数据流等下钻层。 |

Palette stays the existing loop tokens (paper / ink / muted / accent / arcCenter). Page hint: drill on station double-click · empty double-click returns · later layers join this document.

### Deferred hooks

| Entry | Content | Mechanism |
|---|---|---|
| `lake` | 湖仓骨架 × 挖掘大脑（含原内层 SubNetwork） | **Done:** portal → `networks.net-lake-arch` with nested `apps-platforms` / `lake-layers` / `mine-pipeline` restored. Requires multi-level stack ([note](../../implemented/feature/2026-10-22-multilevel-subnetwork-stack.md)). |
| `mine` / `collect` / other stations | 数据流 slices | replace placeholder `networks[net-*]` |
| current `net-*` stubs | keep until real content | do not delete yet |

Engine constraint unchanged: SubNetwork is single-level (root ↔ one child).

### Migration steps

1. Create `智驾数据闭环-整体-topo/`.
2. Copy skill `host.js` + `aitopo.iife.js`; copy eight-loop `diagram.graph.json` and rewrite `meta` only.
3. Emit `diagram.html` from host template with embedded JSON and updated titles/hint.
4. Validate with `parseDocument`; hard-reload: ring visible, no boot flicker, portal drill + empty return.

## Alternatives considered

**Root = new overview with three portals (八环节 / 湖仓 / 数据流).** Rejected for phase 1: higher authoring cost and contradicts “先迁移业务八环节环”; eight-loop already is the business skeleton.

**Root = 湖仓骨架; eight-loop as a SubNetwork.** Rejected: loses the ring as the primary narrative; migration would rewrite layout instead of copying.

**In-place rename of the notes eight-loop folder into 架构设计.** Rejected: breaks existing note links; phase 1 is a copy with updated meta.

## Acceptance criteria

- `架构设计/智驾数据闭环-整体-topo/` contains the four deliverables.
- Root graph matches source eight-loop geometry; only `meta` / page chrome differ as specified.
- Portal SubNetwork stubs still open/return; boot has no camera flash.
- Original `智驾数据闭环-八环节-topo/` remains intact.

## Risks

- Later merge of lake/flow into `networks` may require portal id / stub replacement — phase 1 only reserves the mapping table.
- Single-level SubNetwork means lake internal portals cannot nest another network without flattening or a future engine change.

## Implementation plan

Phase 1 execute checklist (outside Agent Notes gate):

`/Users/macff/Documents/Jeff/notes/02-Tech/03-自动驾驶/03-数据闭环/架构设计/2026-10-22-unified-topo-phase1.plan.md`

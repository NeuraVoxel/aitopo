# Agent Note: ADAS Map demo (SD | HD)

Status: implemented

## Problem

ADAS 已有车道走廊，并删掉了旧的 HD 路口草图，但目录里没有一行用**同一场景**对比 **SD Map**（拓扑中心线）与 **HD Map**（车道 / 连接 / 信号）。

## Decision

新增可加载 `adas-map`（标题 **Map**），排在 Lane 之后、OCC 之前：

| Panel | Content |
|---|---|
| 左 **SD** | 参数化 S 弯干道（同 Lane demo）+ `J1`/`J2`/`J3` + 短 E/W/停车场支路 + ego |
| 右 **HD** | 同一 spine；双车道路带；路况**分散**：信号/停止线/人行横道在 **J1**，人行道在干道中段，PUDO 在 **J2**，停车场在 **J3**，roadblock 在南向接近段 |

共用局部 spine，平移到两个 panel 原点。色值只走 `ADAS_*`。示意草图，非官方瓦片。目录归属：[2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md)。

## Alternatives considered

- **SD / HD 拆成两行目录：** 否决 — 产品要一页左右对比。
- **只有 SD 中心线、没有配对 HD：** 否决 — 重点是同一走廊的精度差。
- **把所有 HD 叠加挤在一个十字路口：** 否决 — 路况应分散在不同路口 / 路段。
- **单独复活已删的 `adas-hdmap-junction`：** 否决 — 新故事是 SD|HD 成对；旧行保持裁剪。

## Consequences

- ADAS 可加载集合为八行。
- Map 作者复用 Lane 原语（ShapeNode / Path / successor Edge），无需新引擎类型。

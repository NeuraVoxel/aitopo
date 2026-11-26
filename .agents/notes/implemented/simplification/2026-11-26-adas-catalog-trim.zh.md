# Agent Note: ADAS catalog trim (stop / traffic / parking / HD map)

Status: implemented

## Problem

ADAS demo 组里有四个可加载样例不再值得占目录位：停车线/人行横道 AABB 近似、交通信号灯 chrome、轴对齐停车位、以及 HD map 路口草图。它们稀释了核心 BEV 叙事（ego / agent / static / lane / OCC），又没有在这些行之外再展示独特的引擎契约。

## Decision

从 ADAS 目录移除下列样例并删除对应模块：

| Removed id | Former title |
|---|---|
| `adas-stop-crosswalk` | Stop & crosswalk |
| `adas-traffic-signals` | Traffic signals |
| `adas-parking-slots` | Parking slots |
| `adas-hdmap-junction` | HD map junction |

`demo/samples/adas/index.ts` 保持核心行顺序（ego → agent → static → lane → OCC）；FOV 随后作为独立可加载样例落地（[2026-11-26-adas-fov-shapenode.md](../feature/2026-11-26-adas-fov-shapenode.md)）。主题 token 与剩余样例仍由 [2026-11-25-demo-adas-group.md](../feature/2026-11-25-demo-adas-group.md) 与 [2026-11-26-adas-foxglove-theme.md](../feature/2026-11-26-adas-foxglove-theme.md) 负责。

## Alternatives considered

- **把四行改成 reserved stub：** 否决 — reserved id 留给缺失的引擎原语；这四行本就可加载，现在是删除而非延期。
- **并入 Lane / Agent：** 否决 — 会撑大样例且没有统一叙事；裁剪比合并更清晰。
- **文件留盘但不注册：** 否决 — 死模块会漂移，且仍触发 ADAS hex 门禁。

## Consequences

- 目录裁剪从 ADAS 导航移除 stop/crosswalk、traffic signals、parking slots 与 HD map junction。
- 注册表断言与 README 目录文案与裁剪后的集合一致（FOV 归属另文）。

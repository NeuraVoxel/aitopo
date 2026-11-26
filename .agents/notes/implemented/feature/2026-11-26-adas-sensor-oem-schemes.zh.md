# Agent Note: ADAS Sensor OEM scheme demo

Status: implemented

## Problem

ADAS 已有通用 FOV 楔形（`adas-fov`），但没有把主流方案的传感器挂在 ego 上做对比。要并排看 Tesla / 小鹏 / 智己 / 华为 / Robotaxi 布局时，目录里没有对应行。

## Decision

新增可加载样例 `adas-sensor`（标题 **Sensor**），排在 FOV 之后：

| Scheme | Tagline sketch |
|---|---|
| Tesla | Vision-first 相机（+ 前向雷达标记） |
| XPeng | 车顶激光雷达 + 相机 + 角雷达 |
| IM（智己） | 车顶激光雷达栈 + 超声波标记 |
| Huawei | 密集 ADS 相机/雷达 + 前向激光雷达 |
| Xiaomi（小米） | SU7 风格车顶激光雷达 + 相机/雷达/超声波 |
| Waymo | Robotaxi 顶置 dome + 辅激光雷达 |

同一文档里 **六辆轴距 ego**，3×2 网格。每车带挂载点（`C`/`R`/`L`/`U`）与淡色 `GraphShapeNode` FOV 扇形。跟随链：挂载点 `followHostId` → ego；FOV 楔形 `followHostId` → 对应挂载点（与 FOV demo 相同契约）。布局是 **公开示意草图**，不是官方标定。扇形几何复用 `demo/samples/adas/sector.ts`（FOV 亦用）。色值只走 `ADAS_*`。目录归属：[2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md)。

## Alternatives considered

- **单车 + 方案切换器：** 否决 — 目录样例整文档 remount；产品要的是并排对比。
- **只画挂载点、不要 FOV：** 否决 — 已选挂载点 + 简化楔形；FOV demo 仍负责单车深挖视场。
- **每个 OEM 单独样例：** 否决 — 一个对比故事不应再拆多行导航。

## Consequences

- ADAS 可加载集合为七行（ego → … → FOV → Sensor）。
- 传感器数量/位置可能落后真实 OEM 改版；描述须保留示意免责声明。

# Agent Note: followHostId element follow

Status: implemented

## Problem

ADAS Agent 历史轨迹（以及类似附着几何）必须在宿主 agent 移动时一起动。twaver 有 `Follower` 位置增量；aitopo 此前没有元素级 follow，拖拽宿主时轨迹会留在原地。

## Decision

在 **Node / Group / Path / ShapeNode**（不含 Edge）上增加可选 `followHostId?: string`：

- 宿主可以是这四种之一；缺失宿主、自跟随、环在 parse / apply 时失败并大声报错。
- 宿主平移 `(dx, dy)`（预览 write 路径与提交 patch）时，跟随者按相同增量平移。Path / ShapeNode 跟随者平移全部控制点；Node / Group 跟随者平移 `x` / `y`（Group 成员坐标保持独立）。
- 级联是传递的。同一 patch / 预览批次中已被显式更新的元素不会被双重平移。
- 删除宿主时清除依赖方的 `followHostId`（update patch 用 `null` 清除）。
- 本波不做角度 / 旋转跟随。
- Elements **Node** demo：`follow-host` + 跟随节点 + 虚线 `follow-trail` 路径（Edit 下拖拽 host）。
- Agent demo：每个动态 agent 都有一条独立历史 `GraphPath`，`followHostId` 指向该 agent id（同一 `DYNAMIC_SPECS` 列表同时生成节点与轨迹）。轨迹沿 −heading 采样，终点在 box 中心（长度随 `speedMs` 缩放）。
- ADAS FOV / Sensor demo：传感器挂载点跟随 ego；FOV `GraphShapeNode` 楔形跟随对应挂载点（拖 ego 时传递级联）。

运行时展开在 `expandFollowMotion`（`src/model/follow.ts`）；实时预览经 scene write 助手调用 `translateFollowersLive`。手势预览会 dirty 跟随者 View（Path 缓存受 dirty 门控），拖拽时轨迹随宿主移动。`PatchHistory` 在 invert 前展开，以便 undo 还原跟随者。

## Alternatives considered

- **仅 Path 支持 followHostId：** 否决 — twaver follow 在基类元素上；Node / Group / ShapeNode 需要同一契约。
- **引擎默认自动附着历史、不加字段：** 否决 — follow 是文档/协议问题，不是 demo 副作用。
- **跟随者随宿主 angle 旋转：** 推迟 — 本波 Agent 历史只需平移。
- **Group 跟随者连成员一起动：** v1 否决 — 成员保持独立坐标；仅 band 原点跟随。

## Consequences

- 协议 schema / parse / patch / invert 增加 `followHostId`（以及 update 上的 `null` 清除）。
- 测试覆盖平移、级联、显式更新跳过、宿主删除清除、parse 失败、以及预览 write。
- ADAS Agent 样例附带三条跟随 Vehicle / Pedestrian / Bicycle 的历史路径。

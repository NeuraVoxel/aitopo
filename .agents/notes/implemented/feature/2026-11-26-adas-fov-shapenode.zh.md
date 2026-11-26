# Agent Note: ADAS FOV sample (ShapeNode sectors)

Status: implemented

## Problem

ADAS 目录长期把 **Sensor FOV** 标成 reserved，等待扇区 / 视锥 overlay。`GraphShapeNode` 落地后，相机 / 雷达 / 激光雷达楔形已可用闭合多边形诚实表达，不必再等专用 frustum 原语，但目录仍拦着这一行，标题也仍叫 Sensor FOV。

## Decision

交付可加载 ADAS 样例：

| Field | Value |
|---|---|
| id | `adas-fov`（替换预留的 `adas-sensor-fov`） |
| title | **FOV** |
| geometry | 绕轴距 ego 的闭合 `GraphShapeNode` 扇形（原点 + 弧） |
| sensors | lidar 270° / radar 120° / camera 60°（前方 = 屏幕向上） |
| follow | 挂载点 `followHostId` → ego；FOV 楔形 `followHostId` → 对应挂载点 |
| chrome | `ADAS_*` 主题 token + `style.alpha`（含 select/hover alpha） |
| layers | `sensors` 在 `agents` 之下 |

删除 `demo/samples/adas/placeholders.ts` — ADAS 不再有 reserved 行。目录顺序仍由 [2026-11-25-demo-adas-group.md](2026-11-25-demo-adas-group.md) 负责。

## Alternatives considered

- **保留 id `adas-sensor-fov` 只改标题：** 否决 — 产品名是 FOV；更短的 id 与目录标签一致，避免永久留下 “sensor-” 后缀。
- **继续等原生 frustum / cone overlay：** 否决 — ShapeNode 扇形已能讲清 BEV FOV；日后可用 frustum 换点列，不必再占第二行目录。
- **用 `GraphPath` 画 FOV：** 否决 — Path 不是节点；楔形需要填充与选中/拖拽，应走 ShapeNode（见 [graph-shape-node](2026-11-26-graph-shape-node.md)）。

## Consequences

- ADAS FOV 行可加载；OEM 挂载对比见 `adas-sensor`（[2026-11-26-adas-sensor-oem-schemes.md](2026-11-26-adas-sensor-oem-schemes.md)）。
- 注册表不再期望 ADAS reserved stub。
- 主题 hex 门禁覆盖 `fov.ts`，与其它 ADAS 样例一致。
- 扇形几何复用 `demo/samples/adas/sector.ts`。

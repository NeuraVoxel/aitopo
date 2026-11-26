# Agent Note: GraphTextStyle.offsetY

Status: implemented

## Problem

作者需要给节点标签少量世界坐标纵向微调（ADAS Sensor 品牌名贴在 ego 下方太紧），又不想新增一套 attachment 方位。

## Decision

`GraphTextStyle` 增加可选 `offsetY`（+Y = 向下）。`LabelAttachment` / `Label2Attachment` 在定位之后应用（含堆叠副标题）。省略 ≡ `0`。ADAS Sensor ego 品牌标签使用 `offsetY: 8`。

## Alternatives considered

- **新方位枚举 / 加大默认 bottom gap：** 否决 — 全局 gap 会带动所有底部标签；为几个像素扩枚举不划算。
- **垫高 ego 盒或假 spacer 字符：** 否决 — 破坏 BEV 比例与 follow 几何。

## Consequences

- Schema / parse 接受 `style.label.offsetY`（及 label2）。
- 像素微调写在文档上；Sensor 品牌不必靠宿主侧布局 hack。

# Agent Note: GraphChromeStyle.alpha for FOV highlight

Status: implemented

## Problem

ADAS FOV 楔形空闲时用很低的 `style.alpha`，方便多层叠放。选中/悬停却只通过 `GraphChromeStyle` 换描边色与线宽，填充扇区高亮时几乎看不见。

## Decision

`GraphChromeStyle` 增加可选 `alpha`。select / hover chrome 生效时，Path / ShapeNode / Node 的 paint DTO 用该透明度（钳制后）替代元素基础 alpha；省略则保持原行为。

ADAS `fovWedge`（`demo/samples/adas/sector.ts`）为 select/hover 配置更高 alpha、更粗描边与 glow，让 FOV / Sensor 楔形在高亮时更醒目，同时不抬高空闲透明度。

## Alternatives considered

- **只加粗描边 / 开 glow：** 否决 — 半透明填充才是楔形可读性的主体；单靠描边仍然弱。
- **宿主在 selectionChanged 里改 `style.alpha`：** 否决 — chrome 应写在元素上；每个 FOV 作者都会重复实现。
- **渲染器写死选中 alpha：** 否决 — 作者需要按元素控制（淡车道 vs 醒目 FOV）。

## Consequences

- 半透明 Path/ShapeNode 可在描边 chrome 旁声明高亮透明度。
- FOV 与 Sensor demo 通过 `fovWedge` 共享更醒目的高亮。

# Agent Note: Document GraphLayer

Status: implemented

## Problem

ADAS 车道填充等衬底需要稳定的 Z 序，且不能绑死在元素类型上。仅靠「填充面」绘制启发式无法表达任意「这一组在那一组之下」、整层禁止拖拽、或整层隐藏——而这些正是 twaver Layer / LayerBox 提供的能力。

## Decision

落地文档图层（对齐 twaver Layer 思路；clean-room 命名）：

- `GraphDocument.layers?: GraphLayer[]` — 数组顺序为自下而上绘制。每层有 `id`、可选 `name`，以及可选 `visible` / `movable` / `editable`（省略 ≡ `true`）。
- Node / Edge / Group / Path / ShapeNode 带可选 `layerId`。省略 → `"default"`。未知 id 与重复 layer id 在 parse / apply 时失败并大声报错。
- 省略或空 `layers` → 单一合成 default 层（旧文档行为不变）。声明列表若不含 `"default"`，则在底部注入合成 default，以便省略 `layerId` 仍可解析。
- Network 绘制 / 命中按层迭代（绘制自下而上，命中自上而下）；`visible: false` 两者都跳过。层内保留既有类型叠层（填充面在线划之下，再是 Group / Edge / Node）。
- 拖拽检查 `layer.movable`；缩放 / 旋转 / Path·Shape 顶点柄检查 `layer.editable`（并叠加元素 `locked`）。
- Phase 1 不做 LayerBox CRUD patch —— 图层经整文档 load 变更；元素 `layerId` 更新（及 `null` 清除）走既有 `update*`。
- Elements **Layer** demo（`layer`）展示 ground / lanes / agents / hidden。ADAS **Lane** 显式打上 `ground` / `lanes` / `agents`。

## Alternatives considered

- **仅填充面启发式：** 否决为长期 Z 契约 — 无法锁层/隐层，也无法跨类型任意叠放。
- **层内纯插入序（更接近 twaver）：** 推迟 — 类型叠层更贴合现有 ADAS / Lane，无需作者手排每个元素。
- **GraphLayer.rotatable / 运行时 LayerBox API：** 留待后续波次。

## Consequences

- 协议、parse、patch、invert、scene `toJSON`、Network 绘制/命中，以及 move/resize/rotate/vertex 交互具备图层意识。
- 测试覆盖未知/重复 layer id、跨层命中优先、隐层、movable/editable、`layerId` 清除，以及 elements 样例。
- Path / ShapeNode / Edge 的选中·悬停描边画在 root、并按文档图层顺序叠放（不再抬到 overlay），这样高亮下层不会盖住上层 Agent。

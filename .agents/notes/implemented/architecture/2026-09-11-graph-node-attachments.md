# Agent Note: GraphNode attachments aligned with twaver.Node

Status: implemented

## Problem

`GraphNode` exposed `label`, optional `status`/`alarms`, and ad-hoc `data` paint hints. [Wave G](./2026-09-11-wave-g-view-facets.md) cached label/meta/alarm as facets inside `NodeView` and painted text inside the body, with gap backlog `Attachment.js` marked `wont`. That kept paint/hit single-sourced but could not grow toward twaver.Node-class behavior: primary and secondary labels outside the body with configurable position/style, registry-backed vector icons, selectable chrome and shadow, and typed attachments whose bounds join the node’s dirty/hit geometry.

## Decision

Protocol approach **A** and lean Attachment base + fixed subclasses under `NodeView` (implementation approach 1). Document stays structured fields; the engine materializes attachments at validate time. This **supersedes** Wave G’s “no Attachment tree” and the gap `wont` on `Attachment.js` / `BasicAttachment.js` for the shipped kinds. Document-serialized `attachments[]` (approach B) is not adopted.

### Protocol (`version` remains `1`)

Additive `GraphNode` fields: `label2?`, `icon?`, `tooltip?`, `style?` (`GraphNodeStyle` with attachment positions, text/chrome/shadow nests, `tooltipMode`). `updateNode` merges `style` one level (nested objects replace as units). `status` stays a business field and does not auto-map to `label2`.

### View / Attachment

Package-private `src/ui/attachment/`: abstract `Attachment`; `IconsAttachment`, `LabelAttachment`, `Label2Attachment`, `AlarmAttachment`, `TooltipAttachment`. `IconRegistry` supplies built-in keys (`node`, `server`, `router`); unknown `icon` keys fall back to `node`.

`NodeView` exposes `bodyBounds` (anchors / move / resize / select chrome) and `unionBounds` / `bounds` (dirty + node hit). Hover-mode tooltips do not contribute to union; they paint on the overlay when the node is hovered. Always-mode tooltips join scene paint and union.

Defaults: Icons `center`, Label `bottom`, Label2 `top`, Alarm `topRight`, Tooltip `right` / `tooltipMode: 'hover'`. Body paint is fill/stroke (+ optional `style.shadow`) only — no in-body primary/secondary text. Omitted `w`/`h` use **50×50** (twaver `NODE_WIDTH` / `NODE_HEIGHT`); runtime changes via `updateNode` `{ w, h }` or resize.

### Paint

`NodePaintView` carries `attachments` (scene) and `overlayAttachments`. `Canvas2DRenderer.drawNode` paints body then scene ops; overlay pass draws select/hover chrome from `style` and overlay attachment ops.

## Alternatives considered

- **B — serialize `attachments[]` on the document:** rejected — doubles alarm/label sources of truth and enlarges the AI patch surface.
- **C — facets only, no Attachment base:** rejected — cannot meet typed attachment + union-bounds growth without a god `NodeView`.
- **Full twaver BasicAttachment stack:** rejected — clean-room lean engine; fixed positions and canvas shadow first.
- **Keep in-body labels with optional attachment mode:** rejected — dual paint paths.
- **Main icon on body instead of IconsAttachment:** rejected — icon is an Attachment at `center`.
- **Hover tooltip inflates unionBounds:** rejected — overlay paint channel.
- **`name` / `name2` field names:** rejected — keep `label` / `label2`.

## Consequences

- Existing documents parse unchanged; visuals move labels outside the body and stop rendering `status`/`data.meta` as a second in-body line unless hosts set `label2`.
- Wave G’s single-validate ownership is preserved; Attachment instances hang off `NodeView`.
- Gap backlog Attachment / Label2 / Icons rows are `done` (lean); free offsets, URL icons, and HTML tooltips remain out of scope.
- [Performance roadmap](../../proposed/architecture/2026-09-11-performance-roadmap.md) Waves J–N are unchanged; attachment count per node stays small.

## Testing

- `tests/node-attachments.spec.ts` — dual bounds, paint ops, icon fallback, alarm, hover/always tooltip, style/icon `updateNode`.
- `tests/view-set.spec.ts` — attachment ops replace former facet assertions.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

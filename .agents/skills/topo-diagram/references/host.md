# Host page contract

## Deliverables (topo)

1. `diagram.graph.json` — valid `version: 1` document (dialect rules apply).
2. `diagram.html` — copy `assets/host/index.html` pattern: embed JSON in `#diagram-data`, load `aitopo.iife.js` + `host.js`, call `TopoDiagramHost.bootFromPage(document)`.

Ship `aitopo.iife.js` beside the page (relative `../aitopo.iife.js` from `assets/host/`, or adjust paths).

## Pinned global `Aitopo` symbols

Only these are guaranteed:

- `Network`
- `parseDocument`
- `CreateEdgeInteraction`
- `layoutGrid`
- `layoutFlowColumns`

Rebuild with `pnpm run bundle:topo-diagram-skill` from the aitopo repo. Do not hand-edit the IIFE.

## Gestures (light edit)

| Action | Gesture |
|---|---|
| Pan / zoom | Default `PanZoomInteraction` |
| Select / activate | Click |
| Toggle group | Double-click group |
| Enter SubNetwork | Double-click portal (`networkId`) |
| Exit SubNetwork | Double-click empty canvas |
| Move node | Drag |
| Create edge | **Alt+drag** from node to node (`CreateEdgeInteraction`) |
| Export | Toolbar Copy / Download → `network.toJSON()` |

## Toolbar (template)

Floating **top-right** chrome: **⋯** menu button (default closed). Click opens a **dropdown list** of actions; click outside or Escape closes. Canvas is full-viewport (`#canvas { inset: 0 }`).

Menu items: Expand all · Collapse all · Copy JSON · Download JSON · Reset. Optional `#toolbar-title` shows `meta.title` when present; gesture hint sits under the list.

Wire ids: `#toolbar`, `#btn-toolbar-toggle`, `#toolbar-menu`, `#toolbar-title`, plus the action buttons above. `bootFromPage` toggles `.is-open` / `aria-expanded` / `hidden`.

No property panel, no Undo UI in v1.

## Reference sample

Open `assets/host/index.html` via a static file server (not always reliable as raw `file://` depending on browser). Golden data: `sample.graph.json` (groups, cross edge `cross`, SubNetwork `detail`).

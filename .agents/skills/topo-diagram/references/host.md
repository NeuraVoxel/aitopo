# Host page contract

## Deliverables (topo)

1. `diagram.graph.json` — valid `version: 1` document (dialect rules apply).
2. `diagram.html` — copy `assets/host/index.html` pattern: embed JSON in `#diagram-data`, load `aitopo.iife.js` + `host.js`, call `TopoDiagramHost.bootFromPage(document)`.

Ship `aitopo.iife.js` beside the page (relative `../aitopo.iife.js` from `assets/host/`, or adjust paths).

## Page chrome (default layout)

Top bar (full width), then a flex-grown canvas that **fits content on load / resize / reset**:

| Region | Element | Content |
|---|---|---|
| Left | `#page-eyebrow`, `#page-title` | `meta.eyebrow` (or `meta.kind`) + `meta.title` |
| Center-right | `#legend` | Project/diagram legend swatches (edit HTML; not inferred from JSON) |
| Far right | `#toolbar` | **⋯** menu |

Canvas (`#canvas`) fills the remaining viewport; `boot` fits content by default (centered, padded). Default **`fitScale: 0.9`** — about 90% of a full `Network#fitContent` zoom so labels / chrome breathe; override via `boot(..., { fitScale: 1 })` for exact fit.

**Boot framing (no flicker):** `#canvas` stays `opacity: 0` until the first double-rAF fit completes, then reveals. `ResizeObserver` only refits after that reveal and only when `clientWidth` / `clientHeight` actually changed — so the deferred mount observe does not repaint after the first framed frame.

**SubNetwork framing:** `boot` listens for `subNetworkChanged` and re-runs the same fit schedule so enter/exit does not keep the parent camera.

## Pinned global `Aitopo` symbols

Only these are guaranteed:

- `Network`
- `parseDocument`
- `CreateEdgeInteraction`
- `layoutGrid`
- `layoutFlowColumns`

Host framing uses `Network#contentBounds` + `updateCamera` / `viewport.fitBounds` with skill `fitScale` (default `0.9`). Engine `fitContent` stays available for exact fit. Host constructs `Network` with `showNodeIcons: false` so centered titles are not covered.

Rebuild with `pnpm run bundle:topo-diagram-skill` from the aitopo repo. Do not hand-edit the IIFE.

If the host needs an engine capability that aitopo lacks, treat it as an **aitopo requirement** (implement in source with twaver as clean-room reference, then rebundle) — see `SKILL.md` Global principle.

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
| Export | Menu Copy / Download → `network.toJSON()` |

## Toolbar / menu (template)

**⋯** button opens a dropdown: Fit view · Expand all · Collapse all · Copy JSON · Download JSON · Reset. Outside click or Escape closes.

Wire ids: `#toolbar`, `#btn-toolbar-toggle`, `#toolbar-menu`, `#btn-fit`, plus the action buttons above. Optional chrome: `#page-title`, `#page-eyebrow`, `#legend`.

No property panel, no Undo UI in v1.

## Reference sample

Open `assets/host/index.html` via a static file server (not always reliable as raw `file://` depending on browser). Golden data: `sample.graph.json` (groups, cross edge `cross`, SubNetwork `detail`).

# Host page contract

## Deliverables (topo)

1. `diagram.graph.json` — valid `version: 1` document (dialect rules apply).
2. `diagram.html` — copy `assets/host/index.html` pattern: embed JSON in `#diagram-data`, load `aitopo.iife.js` + `host.js`, call `TopoDiagramHost.bootFromPage(document)`.

Ship `aitopo.iife.js` beside the page (relative `../aitopo.iife.js` from `assets/host/`, or adjust paths).

## Page chrome (default layout)

Top bar (full width), then a flex-grown canvas that **fits content on load / resize / reset**:

| Region | Element | Content |
|---|---|---|
| Left | `#page-eyebrow`, `#page-title`, optional `#page-lede` / `#page-lede-more` | `meta.eyebrow` (or `meta.kind`) + `meta.title`; `meta.summary` (optional `\n` → second line) |
| Center-right | `#legend` | Project/diagram legend swatches (edit HTML; not inferred from JSON) |
| Far right | `#toolbar` | **⋯** menu |

**Per-SubNetwork chrome:** each child `GraphDocument` may set its own `meta`. On `subNetworkChanged`, the host re-applies the **active** document's meta to the topbar; exit / reset restore the root `meta`.

Canvas (`#canvas`) fills the remaining viewport; `boot` fits content by default (centered, padded). Default **`fitScale: 0.9`** — about 90% of a full `Network#fitContent` zoom so labels / chrome breathe; override via `boot(..., { fitScale: 1 })` for exact fit.

**Boot framing (no flicker):** `#canvas` stays `opacity: 0` until the first double-rAF fit completes, then reveals. `ResizeObserver` only refits after that reveal and only when `clientWidth` / `clientHeight` actually changed — so the deferred mount observe does not repaint after the first framed frame.

**SubNetwork framing:** `boot` listens for `subNetworkChanged` and re-runs the same fit schedule so enter/exit does not keep the parent camera. `bootFromPage` also refreshes topbar chrome from the active `meta`.

## Pinned global `Aitopo` symbols

Only these are guaranteed:

- `Network` (includes `setEditing`, `toRootJSON`, `toJSON`)
- `parseDocument`
- `CreateEdgeInteraction`
- `layoutGrid`
- `layoutFlowColumns`

Host framing uses `Network#contentBounds` + `updateCamera` / `viewport.fitBounds` with skill `fitScale` (default `0.9`). Engine `fitContent` stays available for exact fit. Host constructs `Network` with `showNodeIcons: false` and `defaultInteractions: false`, then `setEditing(false)` by default (basic drag/pan). Pass `boot(..., { editing: true })` to start in full Edit.

Rebuild with `pnpm run bundle:topo-diagram-skill` from the aitopo repo. Do not hand-edit the IIFE.

If the host needs an engine capability that aitopo lacks, treat it as an **aitopo requirement** (implement in source with twaver as clean-room reference, then rebundle) — see `SKILL.md` Global principle.

## Gestures

**Basic (default, Edit mode off)** — same as engine `defaultInteractions`:

| Action | Gesture |
|---|---|
| Pan / zoom | Wheel / drag empty |
| Select / activate | Click |
| Move node / group | Drag |
| Marquee select | Shift-drag |
| Toggle group | Double-click group |
| Enter SubNetwork | Double-click portal (`networkId`) |
| Exit SubNetwork | Double-click empty canvas |

**Edit mode on** (⋯ → **Edit mode**) adds:

| Action | Gesture |
|---|---|
| Bend edge | Select edge → drag bend handles |
| Resize node | Select node → drag corner handles |
| Create edge | **Alt+drag** node → node |
| Delete edge | Select edge → Delete / Backspace |

**Export:**

| Menu item | Source | Notes |
|---|---|---|
| Copy / Download JSON | `network.toRootJSON()` | Full root + nested `networks`, active leaf flushed |
| Download Excalidraw | active `toJSON()` → `.excalidraw` | Rectangles + orthogonal arrows (`export-diagram.js`) |
| Download draw.io | active `toJSON()` → `.drawio` | mxGraphModel XML |
| Download SVG | active `toJSON()` → `.svg` | Vector approx of nodes/edges/groups |
| Download PNG | live Network canvases | Composites root + overlay; current camera view |

Load `export-diagram.js` before `host.js`. Structural exporters approximate orthogonal routes (waypoints honored); they are not pixel-perfect engine paint.

## Toolbar / menu (template)

**⋯** menu is grouped (separator + section label):

1. **View** — Fit view · Expand all · Collapse all  
2. **Edit** — Edit mode (checkbox, **off by default**)  
3. **Export** — PNG · SVG · Excalidraw · draw.io · Copy JSON · Download JSON  
4. **Reset**

Outside click or Escape closes. Edit toggle keeps the menu open so the checkmark is visible.

Wire ids: `#toolbar`, `#btn-toolbar-toggle`, `#toolbar-menu`, `#btn-fit`, `#btn-edit`, `#btn-export-excalidraw`, `#btn-export-drawio`, `#btn-export-png`, `#btn-export-svg`, plus the action buttons above. Optional chrome: `#page-title`, `#page-eyebrow`, `#legend`. Use `.toolbar-menu-sep` / `.toolbar-menu-label` for grouping.

No property panel, no Undo UI in v1.

## Reference sample

Open `assets/host/index.html` via a static file server (not always reliable as raw `file://` depending on browser). Golden data: `sample.graph.json` (groups, cross edge `cross`, SubNetwork `detail`).

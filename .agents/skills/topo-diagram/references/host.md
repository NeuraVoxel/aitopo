# Host page contract

## Deliverables (topo)

1. `diagram.graph.json` — valid `version: 1` document (dialect rules apply).
2. `diagram.html` — host chrome + embedded `#diagram-data`; call `TopoDiagramHost.bootFromPage(document)`.

### Optional source packing (large / multi-SubNetwork diagrams)

For agent-friendly edits, keep **source truth** as fragments and treat the packed document as a build artifact:

| Path | Role |
|---|---|
| `root.graph.json` | Root document **without** nested `networks` |
| `networks/<id>.graph.json` | Child SubNetwork; deeper nests as `networks/<parentStem>/<id>.graph.json` |
| `INDEX.md` | Fragment index (depth / id / file / title) |
| `diagram.graph.json` + `#diagram-data` in HTML | Assembled runtime document |

```bash
node <skill>/scripts/split-fragments.mjs <diagram-dir>     # packed → fragments + INDEX
node <skill>/scripts/assemble-fragments.mjs <diagram-dir>  # fragments → packed JSON + HTML sync + INDEX
```

- Edit only the target fragment (+ `INDEX.md` to locate it); do not feed the whole packed JSON to the model.
- After fragment edits, always **assemble** before opening `diagram.html`.
- Host **Download JSON** is the packed root; to refresh fragments, overwrite `diagram.graph.json` then **split** (rewrites all reachable fragments — use carefully).
- Split strips `networks` from each fragment file and drops `meta.assembledFrom` / `assembledAt`; assemble rebuilds `networks` from portal `networkId`s.

### Shared runtime (default — do not vendor per diagram)

Runtime JS lives **once** in the installed skill:

`…/topo-diagram/assets/aitopo.iife.js`  
`…/topo-diagram/assets/host/host.js`  
`…/topo-diagram/assets/host/export-diagram.js`

Product folders ship **only** JSON + HTML. Script `src` points at those shared files via a **relative href** from the diagram directory (compute with `scripts/runtime-href.mjs <diagram-dir>`).

```html
<script src="…/assets/aitopo.iife.js"></script>
<script src="…/assets/host/export-diagram.js"></script>
<script src="…/assets/host/host.js"></script>
```

| Do | Don't |
|---|---|
| Install / symlink the skill once per vault or repo | Copy `aitopo.iife.js` / `host.js` into every `*-topo/` folder |
| Rebundle skill assets after engine changes | Hand-edit the IIFE; re-copy into diagrams |

Skill-internal sample (`assets/host/index.html`) may keep sibling-relative paths for smoke tests. Optional portable zip still uses `runtime-href` or a one-off copy — not the default authoring path.

## Page chrome (default layout)

Top bar (full width), then a flex-grown canvas that **fits content on load / resize / reset**:

| Region | Element | Content |
|---|---|---|
| Left | `#page-eyebrow`, `#page-title`, optional `#page-lede` / `#page-lede-more` | `meta.eyebrow` (or `meta.kind`) + `meta.title`; `meta.summary` (optional `\n` → second line) |
| Mid | `#example-select` (skill smoke host) | Switch embedded sample ↔ `assets/examples/*.json`; `?example=<id>` deep-link |
| Center-right | `#legend` | Project/diagram legend swatches (edit HTML; not inferred from JSON) |
| Far right | `#toolbar` | **⋯** menu |

**Per-SubNetwork chrome:** each child `GraphDocument` may set its own `meta`. On `subNetworkChanged`, the host re-applies the **active** document's meta to the topbar; exit / reset restore the root `meta`.

Canvas (`#canvas`) fills the remaining viewport; `boot` fits content by default (centered, padded). Default **`fitScale: 0.9`** — about 90% of a full `Network#fitContent` zoom so labels / chrome breathe; override via `boot(..., { fitScale: 1 })` for exact fit.

**Boot framing (no flicker):** `#canvas` stays `opacity: 0` until the first double-rAF fit completes, then reveals. `ResizeObserver` only refits after that reveal and only when `clientWidth` / `clientHeight` actually changed — so the deferred mount observe does not repaint after the first framed frame.

**SubNetwork framing (not enter+exit fit):** do **not** call `fitContent` on every `subNetworkChanged`. Engine fits on first enter when the view is sized; host `boot` re-fits **only** when `direction === "enter" && cameraRestored !== true` (applies skill `fitScale`). Exit restores the pre-enter parent camera; re-enter restores the last in-child camera — host must not fit on those. After those navigations the host adopts the post-chrome canvas size into `lastFitW`/`lastFitH` so a topbar reflow `ResizeObserver` does not treat the height change as a window resize and fit again. `bootFromPage` also refreshes topbar chrome from the active `meta`.

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
| Multi-select toggle | Ctrl/Cmd+click |
| Select all | Ctrl/Cmd+A |
| Move node / group | Drag selected |
| Marquee select | Shift-drag empty (replace) or Ctrl/Cmd-drag empty (XOR); hits nodes, groups, edges |
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

1. **View** — Fit view · **Fullscreen** (checkbox) · Expand all · Collapse all  
2. **Edit** — Edit mode (checkbox, **off by default**)  
3. **Export** — PNG · SVG · Excalidraw · draw.io · Copy JSON · Download JSON  
4. **Reset**

Outside click or Escape closes the menu. Edit / Fullscreen toggles keep the menu open so the checkmark is visible. Fullscreen uses the Page Fullscreen API on `document.documentElement` (top bar + canvas); the host refits the Network after enter/exit. Escape also exits browser fullscreen.

Wire ids: `#toolbar`, `#btn-toolbar-toggle`, `#toolbar-menu`, `#btn-fit`, `#btn-fullscreen`, `#btn-edit`, `#btn-export-excalidraw`, `#btn-export-drawio`, `#btn-export-png`, `#btn-export-svg`, plus the action buttons above. Optional chrome: `#page-title`, `#page-eyebrow`, `#legend`. Use `.toolbar-menu-sep` / `.toolbar-menu-label` for grouping.

No property panel, no Undo UI in v1.

## Reference sample

Open `assets/host/index.html` via a static file server (not `file://` — example switcher uses `fetch`). Default chrome embeds the host sample (groups, cross edge, SubNetwork). Use the **Example** select (or `?example=flowchart-decision`) to load goldens from [`../examples/`](../examples/README.md). Product diagram pages may omit `#example-select`; the control is optional.

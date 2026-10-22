# Agent Note: Topo host export Excalidraw / draw.io / PNG / SVG

Status: implemented

## Problem

The skill ⋯ menu only copied or downloaded GraphDocument JSON. Authors needed portable edits (Excalidraw, draw.io) and raster/vector snapshots (PNG, SVG) without opening the demo IDE.

## Decision

Host-only exporters in `assets/host/export-diagram.js` (loaded before `host.js`):

| Format | Input | Output |
|---|---|---|
| Excalidraw | active `network.toJSON()` | `.excalidraw` JSON (rects + orthogonal arrows) |
| draw.io | active `toJSON()` | `.drawio` mxGraphModel XML |
| SVG | active `toJSON()` | `.svg` (groups, nodes, polylines) |
| PNG | live root + overlay canvases | `.png` (current camera view) |

JSON Copy/Download stay on `toRootJSON()` (full nested tree). Structural exporters approximate routes (honor `waypoints`, axis-align); they are not a second paint engine. No new pinned `Aitopo` symbols; no IIFE change.

Menu ids: `#btn-export-excalidraw`, `#btn-export-drawio`, `#btn-export-png`, `#btn-export-svg`. ⋯ menu groups: **View** · **Edit** · **Export** (PNG → SVG → Excalidraw → draw.io → JSON) · **Reset**.

## Alternatives considered

**Engine-first `Network#exportPng/Svg`.** Deferred — skill host can composite canvases and convert documents without expanding the host contract.

**Only PNG via `html2canvas` of the page.** Rejected — pulls a dependency and captures chrome; canvas composite is enough.

## Consequences

Delivered pages must ship `export-diagram.js` beside `host.js`. Nested SubNetwork exports reflect the **active** layer for Excalidraw/draw.io/SVG; PNG shows the current view.

## Testing

`tests/topo-host-export.spec.ts`: SVG / Excalidraw / draw.io converters emit expected shapes for a tiny GraphDocument.

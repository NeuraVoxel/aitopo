# Agent Note: Document GraphLayer

Status: implemented

## Problem

ADAS lane fills and similar underlays need a durable Z order that is not tied to element kind. A fill-surface paint heuristic cannot express arbitrary “this band of elements sits under that band,” lock a whole band against drag, or hide a band — capabilities twaver exposes via Layer / LayerBox.

## Decision

Ship document layers (twaver Layer ideas; clean-room names):

- `GraphDocument.layers?: GraphLayer[]` — array order is paint bottom → top. Each layer has `id`, optional `name`, and optional `visible` / `movable` / `editable` (omitted ≡ `true`).
- Node / Edge / Group / Path / ShapeNode carry optional `layerId`. Omitted → `"default"`. Unknown ids and duplicate layer ids fail loud at parse / apply.
- Omitted or empty `layers` → single synthetic default layer (old documents unchanged). A declared list without `"default"` gets a synthetic default prepended so omitted `layerId` still resolves.
- Network paint / hit iterate layers (paint bottom→top, hit top→bottom); `visible: false` skips both. Within a layer, keep the existing kind banding (filled surfaces under stroke paths under groups / edges / nodes).
- Drag checks `layer.movable`; resize / rotate / path·shape vertex chrome check `layer.editable` (in addition to element `locked`).
- Phase 1 has no LayerBox CRUD patch ops — layers change via full document load; element `layerId` updates (and `null` clear) go through existing `update*` ops.
- Elements **Layer** demo (`layer`) shows ground / lanes / agents / hidden. ADAS **Lane** stamps `ground` / `lanes` / `agents` explicitly.

## Alternatives considered

- **Fill-surface heuristic only:** rejected as the long-term Z contract — cannot lock or hide bands, and cannot stack arbitrary kinds.
- **Within-layer pure insertion order (closer to twaver):** deferred — kind banding matches current ADAS / Lane demos without forcing authors to hand-order every element.
- **rotatable on GraphLayer / runtime LayerBox API:** deferred to a later wave.

## Consequences

- Protocol, parse, patch, invert, scene `toJSON`, Network paint/hit, and move/resize/rotate/vertex interactions grow layer awareness.
- Tests cover unknown/duplicate layer ids, cross-layer hit preference, hidden layers, movable/editable flags, `layerId` clear, and the elements sample.
- Path / ShapeNode / Edge select·hover stroke paints on the root in document-layer order (not the overlay), so highlighting a lower layer cannot cover higher-layer agents.

# Agent Note: Wave G View label, alarm, and hit facets

Status: implemented

## Problem

After Wave A, Views cached only body/route/band bounds. `Canvas2DRenderer.drawNode` still truncated labels and placed alarm badges every frame from raw node fields, and `Network.hitTestScreen` recomputed `nodeBounds` / `edgeAnchors` independently of Views. Paint and hit could drift, and badge/label work could not share a single validated owner.

## Decision

Wave G thickens Views **without** an Attachment tree or twaver names:

1. **NodeView facets** — On validate, cache truncated primary label, optional meta line, circular flag, and optional alarm badge (`level` + world center/radius matching the Canvas2D badge). `NodePaintView` carries these fields; `drawNode` paints from the DTO (fill/stroke still from node `data` / status).
2. **EdgeView route exposure** — `points` getter for the validated polyline used by paint.
3. **Hit-test via Views** — `Network.hitTestScreen` / `hitTestGroupScreen` validate dirty Views first, then hit node/group `bounds` and edge `points` from Views (same geometry as the last validate). Helpers remain in `ui/bounds.ts` for unit tests and non-Network callers.

Document / Patch / Events unchanged. No `measureText` (truncation stays character-budget based).

Execution checklist: [Wave G plan](../../../../docs/2026-09-11-aitopo-wave-g-view-facets.md).

### Deferred (not Wave G)

InteractionHost / GestureController split (Wave H); rotate / move-link; pixel hit-test; secondary labels / icon strips.

## Alternatives considered

- **Clone Attachment / AlarmAttachment hierarchy:** rejected — clean-room non-goal; facets on existing Views are enough.
- **Keep hit on raw `nodeBounds` / `edgeAnchors` only:** rejected — dual geometry owners were the drift risk Wave A deferred.
- **Canvas `measureText` in validate:** rejected — needs a ctx in View validate; character truncate matches current paint.
- **Public View exports:** rejected — Views stay package-private; Network owns hit.

## Consequences

- Alarm/label layout is owned by NodeView; renderer stops re-deriving badge position and truncate lengths.
- Hit-test after validate matches painted node boxes and edge polylines.
- Out-of-tree `Renderer` implementers must accept extended `NodePaintView` fields (additive).
- Marquee / resize / move still read live scene bounds for gesture math (mutation source of truth).

## Testing

- `tests/view-set.spec.ts` — label/alarm facets; edge points stable until dirty.
- `tests/hit-views.spec.ts` — Network hit uses View bounds/routes after mount.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

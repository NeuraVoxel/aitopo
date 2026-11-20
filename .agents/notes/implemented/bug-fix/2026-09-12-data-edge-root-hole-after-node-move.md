# Agent Note: Scene pass keeps hover-related data edges on the root layer

Status: implemented

## Problem

After moving a node, its `kind: 'data'` edges rendered partially or not at all. While a node is hovered, `edgeHighlightFlags` marks its incident data edges as hover-related, and the scene pass skipped such edges ("highlighted edges paint only in the overlay pass"). Every scene repaint during the hover (drag previews, drop commit) cleared the edge's pixels from the root layer within the dirty union. Unhover only schedules an overlay-only frame (`setHover` → `requestOverlayPaint`), which removes the highlight but never repaints the root — the hole stayed exposed wherever stale pixels outside the last dirty union did not cover the path.

## Decision

`Network.validate`'s scene pass now always draws every active edge with its base paint (`toPaintView(false, false)`), regardless of selection or hover state; the overlay pass keeps stacking select/hover styling on top. This keeps `setHover` overlay-only while guaranteeing the root layer never loses edge pixels, so overlay-only unhover transitions cannot expose holes. (`setSelection` later scene-paints for under-body glow — see [selection glow](../feature/2026-11-20-hover-glow.md) — but the base edge paint rule still covers hover-related holes.) The same fix covers the latent variants: directly hovered edges and selected edges skipped by any scene paint (pan/zoom/move) while highlighted.

## Alternatives considered

**Schedule a scene repaint in `setHover`/`setSelection` covering affected edge rects.** Heals holes at transition time but would have broken the overlay-only hover contract, adds per-hover-change scene work, and still needs old+new edge bookkeeping on every hover change. (Selection later gained scene paint for body glow for an unrelated reason; hover stayed overlay-only.)

**Restrict the skip to directly hovered/selected edges (keep skipping only related-data ones).** Smaller diff but keeps the root-hole class for selected/directly-hovered edges; the unconditional base paint removes the whole class at the cost of one redundant root draw that the overlay highlight already covers visually.

## Consequences

While an edge is highlighted, its base paint is redrawn on the root layer during scene frames — matching the appearance users already saw when a highlight was applied without an intervening scene repaint. Overlay-frame behavior, dirty-rect sizes, and highlight styling are unchanged.

## Testing

`tests/paint-channels.spec.ts` "scene repaints keep hover-related data edges on the root layer" hovers a node, previews a move, and asserts the scene frame contains a non-highlighted edge base paint; unhover remains an overlay-only frame. Verified red without the fix and green with it. Full suite: 171 passed; the only failure is the pre-existing `demo-registry.spec.ts` `labelPosition` sample mismatch unrelated to this change.

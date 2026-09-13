# Agent Note: Collapsed groups match node styling (dark fill, node-like icon)

Status: implemented

## Problem

A collapsed Group paints as a node, but its defaults diverged from actual nodes: body `#64748b` (mid slate) with stroke `#475569`, while nodes render near-black `statusFill` with `statusStroke`; and the default `group` icon was two stacked half-height cards with no relation to the node icon (square + center dot). Collapsed groups therefore read as a different species of element.

## Decision

- `group-view.ts` collapsed defaults become `COLLAPSED_FILL = '#1a1d24'`, `COLLAPSED_STROKE = '#334155'` — the same values as `statusFill(undefined)`/`statusStroke(undefined)`, so a collapsed group is visually a node unless `style.fill`/`style.stroke` override. Expanded band colors are untouched. The contrasting-ink icon path (`withContrastingIcons`) automatically keeps the light glyph on the darker fill.
- The builtin `group` icon is redrawn in the node idiom: a front square with a filled center dot (matching the `node` icon's geometry), plus a back card peeking bottom-right to keep the "multiple members" grouping cue.

## Alternatives considered

**Give the icon its own dark badge background.** Rejected: the icon sits on the body fill; a badge would fight the body color and double the styling surface. Matching the body fill to nodes achieves the "黑底" look at the right layer.

**Derive collapsed fill from the group's `status` via `statusFill`.** Deferred: groups have no documented status semantics today; hardcoding the neutral node defaults keeps the change visual-only. Revisit if group statuses become a thing.

## Consequences

Collapsed groups render near-black with slate stroke and a node-style glyph; `style.fill`/`style.stroke` still override per group. No schema or protocol change.

## Testing

`tests/group-attachments.spec.ts` "defaults to collapsed node body 50×50 with group icon" now pins `paint.fill === '#1a1d24'` and `paint.stroke === '#334155'`. Typecheck clean.

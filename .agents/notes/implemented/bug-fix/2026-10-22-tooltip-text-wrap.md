# Agent Note: Tooltip text wraps inside the background

Status: implemented

## Problem

Long tooltip strings (especially CJK) overflowed the dark background pill. Width came from a Latin-biased `estimateTextSize` (~0.6em per glyph), so CJK content was underestimated; paint drew a single `fillText` centered in that too-narrow box.

## Decision

Tooltips wrap to a fixed max content width (~160px ≈ 14 CJK glyphs at 11px) before padding.

- `layoutWrappedText` / `estimateTextWidth` in `src/ui/attachment/position.ts` — CJK / fullwidth glyphs use ~1em advance; Latin ~0.55em; honors explicit `\n`.
- `TooltipAttachment` and `EdgeTooltipAttachment` size bounds from the wrapped layout; paint ops carry optional `lines`.
- `Canvas2DRenderer` draws each line with the same line-height used for layout (`fontSize * 1.25`).
- Truncation at 96 characters still applies before wrap.

Hover/always mode unchanged. Default `tooltipPosition: topRight` places the tip with **bottom-left** flush to the body **top-right** (`placeTooltip`). Labels and alarms stay single-line.

## Alternatives considered

- **Widen the background to the full single-line estimate:** rejected — long CJK tips become huge floating bars and still fight the viewport.
- **HTML / DOM tooltips:** rejected — out of scope for the lean canvas attachment stack ([GraphNode attachments](../architecture/2026-09-11-graph-node-attachments.md)).
- **Per-document `tooltipMaxWidth` style:** deferred — one engine default is enough for skill diagrams; add later if hosts need it.

## Consequences

- Long tooltips grow taller instead of wider past the wrap budget; hover-mode tips still stay off union.
- Callers that assumed a single-line `text` still work (`text` is joined with `\n`; paint falls back to `text.split('\n')` when `lines` is omitted).

## Testing

- `tests/tooltip-wrap.spec.ts` — wrap layout + node tooltip paint op with multiple lines / capped width.
- `tests/node-attachments.spec.ts` / `tests/edge-attachments.spec.ts` — hover/always tooltip contracts unchanged.

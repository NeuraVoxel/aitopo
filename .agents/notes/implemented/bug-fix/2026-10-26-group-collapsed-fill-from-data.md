# Agent Note: Collapsed group fill honors style then data (not only dark default)

Status: implemented

## Problem

Skill topology diagrams authored Group band colors on `data.fill` / `data.stroke` (node-like), while `GroupView` only read `style.fill` / `style.stroke`. Collapsed groups therefore fell through to `COLLAPSED_FILL` `#1a1d24` and looked black, unlike 湖仓底座 groups that already put light fills on `style`.

## Decision

- `group-view.ts` resolves fill/stroke as `style` → `data` → expanded/collapsed defaults for both expanded and collapsed paint.
- Topo dialect documents that architecture Groups should set `style.fill` / `style.stroke` (lake-band tokens); `data.*` remains a secondary authoring path.
- Deliverable 智驾闭环 topo graphs copy band colors onto `style` to match 湖仓底座 chrome when collapsed.

## Alternatives considered

**Change `COLLAPSED_FILL` to paper gray.** Rejected: demos and [collapsed node-style note](../feature/2026-09-13-collapsed-group-node-style.md) intentionally keep near-black defaults when no override is authored.

**Only patch diagram JSON, no engine fallback.** Rejected as incomplete: future skill output that only sets `data.fill` would regress to black on collapse.

## Consequences

Light architecture Groups stay light when collapsed if either `style` or `data` carries fill/stroke. Unstyled Groups still collapse to the dark node body.

## Testing

`tests/group-attachments.spec.ts` — collapsed body with only `data.fill`/`data.stroke` paints those colors; default collapsed pins unchanged.

# Agent Note: Group label position stable across expand/collapse

Status: implemented

## Problem

`GroupView.withLabelDefaults` forced `labelPosition: 'top'` when expanded and `'bottom'` when collapsed unless the host set `style.labelPosition`. Toggling expand/collapse moved the title from above the band to below the collapsed node, which looked like a jump and conflicted with the documented Group default of `top`.

## Decision

Drop expand-dependent label defaults. `LabelAttachment` already resolves Group labels to `top` when `style.labelPosition` is omitted; expanded and collapsed use that same default. Hosts still override with `style.labelPosition` (including `insideTop*`).

## Alternatives considered

- **Keep collapsed `bottom` (node-like):** rejected — expand/collapse must not change label side unless the host opts in.
- **Default both states to `insideTopLeft`:** deferred — outside `top` remains the Group default; inside titles stay host opt-in ([inside top attachment](./2026-09-12-inside-top-left-attachment.md)).

## Consequences

- Collapsed Groups with no `labelPosition` paint the title above the 50×50 body (may sit over icons/`label2` less like a node caption).
- Explicit `style.labelPosition` is unchanged across expand/collapse.

## Testing

- `tests/group-attachments.spec.ts` — default label sits above `bandBounds` for both `expanded: false` and `expanded: true`.

## Related

Superseded by [collapsed vs expanded label anchors](./2026-10-27-group-collapsed-label-position.md) (`collapsedLabelPosition`, omit → `bottom` when collapsed).

# Agent Note: Group collapsed vs expanded label anchors

Status: implemented

## Problem

A single `style.labelPosition` applied in both expand and collapse states. Skill architecture bands want `insideTop` when open and a node-like `bottom` caption when folded; forcing one value made collapsed cards look wrong or required host rewrites on every toggle.

## Decision

`GraphGroupStyle.collapsedLabelPosition` anchors the title when collapsed (omit → **`bottom`**). Expanded titles keep `labelPosition` (omit → **`top`**). `LabelAttachment` / subtitle stacking resolve via `resolveGroupLabelPosition`. Expand/collapse gestures do not rewrite either field. Topo-diagram skill authors `labelPosition: "insideTop"` for expanded bands and relies on the collapsed omit default (override with `collapsedLabelPosition` only when needed).

## Alternatives considered

**Keep one labelPosition for both states ([prior stable-default note](./2026-09-12-group-label-position-stable.md)).** Rejected: skill and twaver-like collapsed captions need a different side without clearing `insideTop`.

**Collapsed omit falls through to labelPosition before bottom.** Rejected: skill `insideTop` would leak onto collapsed chips; omit must mean bottom.

## Consequences

Demo Groups with no style paint titles below the body when collapsed and above when expanded. Documents that relied on collapsed titles staying at `top` without setting `collapsedLabelPosition` must opt in with `collapsedLabelPosition: "top"`.

## Related

Supersedes the “no expand-dependent defaults” rule in [group label position stable](./2026-09-12-group-label-position-stable.md).

## Testing

`tests/group-attachments.spec.ts` — collapsed default below body; expanded default above; `collapsedLabelPosition` independent of `labelPosition`.

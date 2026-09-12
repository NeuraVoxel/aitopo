# Agent Note: Inside top-left attachment position for Group titles

Status: implemented

## Problem

`AttachmentPosition` placed `top` / `topLeft` **outside** the body (`y = body.y - gap - height`). Observe Architecture / DataFlow stack Groups vertically; outside titles of the lower band overlapped the upper band. Hosts could only add vertical clearance (Observe used `GROUP_OUTSIDE_LABEL_CLEARANCE = 36`). Classic topology Group titles sit **inside** the band at the upper-left (pre-attachment `drawGroup` painted at `bounds.x+8, bounds.y+6`).

## Decision

Additive `AttachmentPosition` members: `insideTop`, `insideTopLeft`, `insideTopRight`. `placeAttachment` insets ≈ **8** world px from the body edge (matches the old in-body title). Outside positions are unchanged. Zod enum updated; document `version` stays `1`.

Group label default remains **`top`** (outside) for backward look. Hosts that want band titles set `style.labelPosition: 'insideTopLeft'` (Observe Architecture / DataFlow).

## Alternatives considered

- **Host-only larger gaps forever:** works but wastes canvas and still looks like a floating caption, not a band title.
- **Reuse `center` with free offsets:** rejected until free offsets exist; corner titles need a named anchor.
- **Negative gap hack on `topLeft`:** rejected — gap is not host-configurable on LabelAttachment.
- **Switch Group default to `insideTopLeft`:** deferred — keep `top` unless hosts opt in.

## Consequences

- New enum members are additive; existing positions unchanged.
- Long untruncated group titles with `insideTopLeft` stay inside `bandBounds` (union may still grow if text exceeds the band width).

## Testing

- `tests/attachment-position.spec.ts` — `insideTop*` rects lie inside the body; outside `topLeft` stays above.
- `tests/group-attachments.spec.ts` — `labelPosition: 'insideTopLeft'` paint bounds inside `bandBounds`.

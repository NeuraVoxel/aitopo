# Agent Note: Inside top-left attachment position for Group titles

Status: proposed

## Problem

`AttachmentPosition` places `top` / `topLeft` **outside** the body (`y = body.y - gap - height`). Observe Architecture / DataFlow stack Groups vertically; outside titles of the lower band overlap the upper band. Hosts can only add vertical clearance (Observe uses `GROUP_OUTSIDE_LABEL_CLEARANCE = 36`). Classic topology Group titles sit **inside** the band at the upper-left (pre-attachment `drawGroup` painted at `bounds.x+8, bounds.y+6`).

## Decision (proposed)

Add `insideTopLeft` (and optionally `insideTop` / `insideTopRight` for symmetry) to `AttachmentPosition`:

- Place the attachment box inset from the body corner (e.g. `x = body.x + inset`, `y = body.y + inset`), not above the band.
- Default inset ≈ 8 world px (match the old in-body title); optional later `style.label.inset` if hosts need tuning.
- Zod / schema / `placeAttachment` / exhaustiveness updated; document `version` stays `1`.

Observe would then set `labelPosition: 'insideTopLeft'` and can shrink band gaps.

## Alternatives considered

- **Host-only larger gaps forever:** works but wastes canvas and still looks like a floating caption, not a band title.
- **Reuse `center` with free offsets:** rejected until free offsets exist; corner titles need a named anchor.
- **Negative gap hack on `topLeft`:** rejected — gap is not host-configurable on LabelAttachment.

## Consequences

- New enum member is additive; existing positions unchanged.
- Group default in `withLabelDefaults` may stay `top` (outside) for backward look, or switch to `insideTopLeft` for expanded bands — product call when implementing.

## Testing

- `placeAttachment('insideTopLeft', …)` rect is fully inside `body`.
- Group attachment paint / hit with long untruncated titles stay within bandBounds.
- Observe Architecture: adjacent groups can use a small padding without label overlap when switched to `insideTopLeft`.

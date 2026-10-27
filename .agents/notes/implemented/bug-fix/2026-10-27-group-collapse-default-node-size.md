# Agent Note: Collapse parks node-sized body (twaver-aligned)

Status: implemented

## Problem

[Keep-band-size on collapse](./2026-10-26-group-collapse-keep-band-size.md) wrote the expanded band's `x/y/w/h` into the Group on every fold. Large auto-fit bands therefore stayed large when collapsed, which diverges from twaver.vector (Group paints as a Node with its own size when collapsed) and from authors who expect the default 50×50 chip unless they configure otherwise.

## Decision

`expandCollapseCenterPatches` on collapse centers the collapsed body on the expanded band center and **does not write `w`/`h`**. Collapsed size comes from authored `GraphGroup.w` / `h` (twaver Group node size); omitted → engine default **50×50**. Expand still recenters members on the collapsed body center after a drag. No new protocol fields.

## Alternatives considered

**Keep band footprint on collapse (prior note).** Rejected: conflicts with twaver.vector and with "default chip unless configured."

**Add `collapsedW` / `collapsedH` fields.** Rejected: existing `w`/`h` already mean collapsed (and `autoFit: false` expanded) body size.

## Consequences

Double-click collapse shrinks to the configured or default node body. Documents that still carry large `w`/`h` from the prior keep-band-size toggle keep that size until authors clear or change those fields — that is the supported configuration path.

## Related

Supersedes [collapse keeps expanded band size](./2026-10-26-group-collapse-keep-band-size.md).

## Testing

`tests/group-attachments.spec.ts` — default 50×50 park on painted-band center; authored `w`/`h` honored; expand recenters after drag.

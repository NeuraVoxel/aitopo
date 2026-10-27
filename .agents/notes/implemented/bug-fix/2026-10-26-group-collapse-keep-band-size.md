# Agent Note: Collapse keeps expanded band size (no frame jump)

Status: implemented

## Problem

Double-click collapse parked a small node-sized body (document `w`/`h` or default 50×50) at the expanded band center. Architecture diagrams with large auto-fit bands therefore jumped in size when folding a Group.

## Decision

`expandCollapseCenterPatches` on collapse writes `x/y/w/h` from `computeExpandedBandBounds` (painted extents when a member-bounds resolver is passed). The collapsed frame matches the expanded rectangle; expand still recenters members on the collapsed body center if the frame was dragged.

## Alternatives considered

**Keep 50×50 card and only fix fill.** Rejected: user-reported jump was geometric, not only color.

**Disable size change via skill-only JSON `w`/`h` matching band.** Rejected: auto-fit bands drift as members move; collapse must snapshot the live band.

## Consequences

Collapsed Groups stay the same footprint as the open band. Authors who want a small collapsed chip must set an explicit small `w`/`h` and `autoFit: false`, or accept that toggle will overwrite `w`/`h` with the band snapshot.

## Testing

`tests/group-attachments.spec.ts` — collapse keeps painted band rectangle; expand still recenters after drag.

## Related

Superseded by [collapse parks node-sized body](./2026-10-27-group-collapse-default-node-size.md) (twaver-aligned default / authored `w`/`h`).

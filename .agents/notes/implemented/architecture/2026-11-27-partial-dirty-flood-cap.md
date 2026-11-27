# Agent Note: Partial dirty absorb cap

Status: implemented

## Problem

Live drag of one node often paid whole-graph paint cost. Preview seeds already union mover + incident edge AABB + far endpoint. `expandPartialDirty` then flood-filled every intersecting element’s **full** padded bounds into that seed. A long edge corridor absorbed tall neighbors, which absorbed further siblings, until the dirty hole (and draw cull) covered nearly every element — while still reporting a “partial” rect.

## Decision

**Absorb cap → `'all'`** — When `expandPartialDirty` runs (default **on** — [defaults on](./2026-11-27-expand-partial-dirty-default-on.md); gate from [expand opt-in](./2026-11-27-expand-partial-dirty-opt-in.md)), absorbing more than `MAX_PARTIAL_DIRTY_ABSORBS` (24) elements returns `'all'` instead of a snowballed union. Caps unbounded while-loop cost on dense overlap chains and makes “effectively full frame” explicit.

Preview always runs expand (same as apply / selection). An earlier preview skip-expand attempt was withdrawn for residual safety — see [preview skip-expand withdrawn](../bug-fix/2026-11-27-preview-skip-expand-withdrawn.md).

Does not change Document / Patch / Events. Multi-rect dirty and drag-filter full-frame narrowing remain later Wave K work on the [performance roadmap](../../proposed/architecture/2026-09-11-performance-roadmap.md). Lift-to-overlay drag is a separate follow-up.

Partially supersedes the unbounded-flood consequence of [neighbor expand](../bug-fix/2026-11-26-partial-dirty-neighbor-expand.md): expand remains, with a hard absorb ceiling. Far-endpoint seeding on preview is unchanged ([far-endpoint residual](../bug-fix/2026-11-20-far-endpoint-dirty-residual.md)).

## Alternatives considered

- **Only raise pads / shrink edge AABB:** rejected — does not stop flood growth through overlapping bodies along a corridor.
- **Remove `expandPartialDirty` entirely:** rejected — apply / pulse / preview still need full-neighbor clear for AA / rotated-ink seams (neighbor-expand note).
- **Always `markAll` on connected preview moves:** rejected — sparse graphs would lose partial clip when absorb stays under the cap.
- **Multi-rect dirty in this change:** rejected — larger Wave K slice; absorb cap ships first.
- **Preview skip-expand (seed-only dirty):** attempted then withdrawn — clear holes through neighbors without expand leave residuals ([withdrawal](../bug-fix/2026-11-27-preview-skip-expand-withdrawn.md)).

## Consequences

- Dense overlapping expand chains that would absorb >24 neighbors paint `'all'` instead of a giant partial rect.
- Preview and apply both expand; drag on sparse graphs keeps partial clip when under the cap.
- `debugPaintStats` (Wave J) still deferred; absorb count is test-covered, not yet a HUD counter.

## Testing

- `tests/paint-channels.spec.ts` — apply overlap chain over cap → `'all'`; existing neighbor-expand and far-endpoint cases remain.

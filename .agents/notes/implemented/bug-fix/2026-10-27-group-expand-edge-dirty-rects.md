# Agent Note: Group expand/collapse dirties remapped edge paint rects

Status: implemented

## Problem

After Group expand/collapse, agent-link remapping recomputed in EdgeView, but the Network dirty accumulator often only covered the group band. Cross-boundary strokes that left the band (and intra-group edges that vanished) were not cleared/repainted until a later full-frame invalidate — links looked stale.

Root cause is **engine**: `collectPatchDirty(updateGroup)` lists the group id; collapse patches usually have no `memberMoves`, so incident edges are not in the dirty id set. `syncDirtyFromScene` marked those edges dirty for validate but did not union their old/new bounds into paint dirty rects.

Skill Expand/Collapse all used raw `{ expanded }` apply, which hits the same path (and skips band-size snapshot).

## Decision

- `Network#syncDirtyFromScene` captures **group topology rects** (band + visible members + incident active edges) before and after validate when a dirty id is a group.
- Topo host `setAllGroupsExpanded` prefers `Network#toggleGroupExpanded` so geometry snapshot + dirty path match double-click.

## Alternatives considered

**Always `dirty.markAll()` on updateGroup.** Rejected: heavier than needed for every group style tweak; topology capture is enough for expand/collapse.

**Skill-only full-frame after Expand all.** Rejected: double-click collapse would still leave stale cross edges.

## Consequences

Collapse/expand clears and redraws remapped links in the same frame. Style-only `updateGroup` still dirties member/edge topology rects when the group id is listed — acceptable extra paint.

## Testing

`tests/paint-channels.spec.ts` — group collapse dirty union reaches the far cross-edge endpoint. `tests/group-attachments.spec.ts` remap behavior unchanged.

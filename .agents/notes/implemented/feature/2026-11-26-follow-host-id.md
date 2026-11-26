# Agent Note: followHostId element follow

Status: implemented

## Problem

ADAS Agent history trails (and similar attached geometry) must move when their host agent moves. twaver exposes `Follower` location deltas; aitopo had no element-level follow, so trails stayed fixed while the host dragged.

## Decision

Add optional `followHostId?: string` on **Node / Group / Path / ShapeNode** (not Edge):

- Host may be any of those four kinds; missing host, self-follow, and cycles fail loud at parse / apply.
- On host translate `(dx, dy)` (preview write paths and commit patches), followers translate by the same delta. Path / ShapeNode followers shift all control points; Node / Group followers shift `x` / `y` (group members stay independent).
- Cascade is transitive. An element that is also updated explicitly in the same patch / preview batch is not double-translated.
- Host delete clears `followHostId` on dependents (`null` clear on update patches).
- Angle / rotation follow is out of scope for this wave.
- Elements **Node** demo: `follow-host` + follower node + dashed `follow-trail` path (drag host in Edit).
- Agent demo: every dynamic agent owns a freestanding history `GraphPath` with `followHostId` set to that agent id (same `DYNAMIC_SPECS` list builds both). Trails sample along −heading and end at the box center (length scales with `speedMs`).
- ADAS FOV / Sensor demos: sensor mount nodes follow ego; FOV `GraphShapeNode` wedges follow their mount (transitive cascade when ego moves).

Runtime expansion lives in `expandFollowMotion` (`src/model/follow.ts`); live preview uses `translateFollowersLive` from scene write helpers. Gesture preview dirties follower views (path caches are dirty-gated) so trails move with the host during drag. `PatchHistory` expands before invert so undo restores followers.

## Alternatives considered

- **Path-only followHostId:** rejected — twaver follow is base-element; Node / Group / ShapeNode need the same contract.
- **Engine default auto-attach of history without a field:** rejected — follow is a document/protocol concern, not a demo-only side effect.
- **Rotate followers with host angle:** deferred — Agent history only needs translate for this wave.
- **Group follower moves members with the band:** rejected for v1 — members keep independent coords; only the band origin follows.

## Consequences

- Protocol schema / parse / patch / invert grow `followHostId` (and `null` clear on updates).
- Tests cover translate, cascade, skip-when-explicit, host delete clear, parse failures, and preview writes.
- ADAS Agent sample ships three history paths that follow Vehicle / Pedestrian / Bicycle.

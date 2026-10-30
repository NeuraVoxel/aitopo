# Agent Note: Multi-level SubNetwork stack

Status: implemented

## Problem

Embedding「湖仓骨架 × 挖掘大脑」as a child of the eight-loop root required a second drill into that child's own `networks` (应用层 / 湖仓分层 / 挖掘流水线). `GraphScene.enterSubNetwork` rejected any enter while already inside a child (`only one level is supported`), so nested portals had to strip `networkId` and lost the original drill-down.

## Decision

- `GraphScene` keeps a `networkStackIds` path (empty at root). `currentNetworkId` is the tip; `networkStack` exposes the full path.
- `enterSubNetwork(id)` resolves `active.networks[id]` (not only root), pushes `id`, rejects missing keys and cycles along the path.
- `exitSubNetwork()` pops one level and reloads the document at the new tip via `resolveDocAtStack(root, stack)`.
- `apply` writes the active leaf back with `writeDocAtStack` so nested edits persist under `root.networks…`.
- Live map sync (`writePositions` / bounds / waypoints / group positions) preserves `meta` and `networks` on `active`.
- `Network.exitSubNetwork` emits the real tip/`stack` (no longer hardcodes root).

Dialect / skill: SubNetwork is a stack; prefer shallow depth (≤2–3).

## Alternatives considered

**Host exit-then-enter to a root-registered nested id.** Rejected: empty double-click would skip the middle overview and jump to root.

**Engine change deferred; keep stripped portals.** Rejected: user required the original lake nested drills inside the unified topo.

## Consequences

Unified topo can nest `net-lake-arch` and keep `apps-platforms` / `lake-layers` / `mine-pipeline` under that child. Deep stacks are allowed but discouraged. Existing single-level docs behave as before (stack length 0 or 1).

## Testing

`tests/scene-graph.spec.ts`: nested enter/exit, nested apply survives round-trip, missing id and cycle throw. Prior single-level enter/exit and `select-activate` navigation still pass.

## Related

Camera restore on exit: [exit SubNetwork restores pre-enter camera](./2026-10-30-subnetwork-restore-camera.md).

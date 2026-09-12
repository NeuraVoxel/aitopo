# Agent Note: Double-click navigates sub-networks (enter on node, exit on empty)

Status: implemented

## Problem

Entering a sub-network was only possible through host API calls (the demo wired a hardcoded toolbar button to `enterSubNetwork('team-a')`), and leaving required the matching exit button. The canvas itself offered no navigation gestures: `SelectActivateInteraction` detected double-clicks but only emitted `nodeActivated`, which nothing consumed for navigation.

## Decision

`InteractionHost` gains an `InteractionNavigationHost` facet — `enterSubNetwork(id)`, `exitSubNetwork()`, `readonly currentNetworkId` — implemented by `Network` (enter/exit existed; `currentNetworkId` now exposes `scene.currentNetworkId`). `SelectActivateInteraction` owns the gestures:

- **Double-click a node with `networkId`** → `enterSubNetwork(node.networkId)`. Navigation replaces the `dblclick` activation event for that node; the first click of the pair still fires the normal single-click activation (a double cannot be known before the second click). Nodes without `networkId` keep `dblclick` activation.
- **Double-click empty space while inside a sub-network** (`currentNetworkId !== null`) → `exitSubNetwork()`. At the root network, empty double-click does nothing. Empty-space tracking uses the same 350ms window and is independent of node/group click state (cleared whenever a node or group click lands).

Drag gating is unchanged: a drag-consumed gesture never navigates. `subNetworkChanged` remains the single navigation event (view rebuild, history/selection reset stay in consumer hands, as the demo already handles).

## Alternatives considered

**Navigate inside `Network.activateNode`.** Would bury a gesture decision in the event fan-out and still need a new surface for empty-space double-click, which no event currently carries.

**Native `dblclick` DOM event on the canvas.** The interaction already owns pointer-based double-click detection with drag gating and the 350ms window shared across node/group/empty targets; a parallel native listener would split that logic in two.

## Consequences

Sub-networks are reachable without host UI (double-click in, double-click out), matching the twaver-style expectation that the canvas is self-navigating. Nodes that both carry `networkId` and need custom `dblclick` activation lose the latter — navigation wins; hosts needing both should listen to `subNetworkChanged` plus their own gesture handling. Fake interaction hosts in tests implement the new facet.

## Testing

`tests/select-activate.spec.ts` "SelectActivate sub-network navigation": double-click on a `networkId` node enters and skips `dblclick` activation (first-click activation pinned explicitly); double-click on a plain node still activates; empty-space double-click inside a sub-network exits; at the root it is a no-op. Full suite and typecheck pass.

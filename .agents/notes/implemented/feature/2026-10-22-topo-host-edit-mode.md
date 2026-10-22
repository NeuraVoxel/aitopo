# Agent Note: Topo host Edit mode + root JSON export

Status: implemented

## Problem

The skill host always attached move + Alt+drag create, with no browse/edit gate in the **⋯** menu. Copy/Download used `Network#toJSON()`, which returns only the **active** SubNetwork leaf — not the full root tree after nested edits.

## Decision

- **`Network#setEditing(enabled)`** replaces the interaction stack without remounting:
  - `false` (basic / host default): `PanZoom` + `SelectActivate` + `MoveNode` + `MarqueeSelect` — same as constructor `defaultInteractions`.
  - `true` (Edit): basic + `MoveEdgeBend` + `ResizeNode` + `DeleteEdge` + `CreateEdge` (`requireAlt`, kind from `createEdgeKind` / default `flow`). Bend and resize pack **before** move.
- **`GraphScene#toRootJSON` / `Network#toRootJSON`**: flush active leaf via `writeDocAtStack`, return a deep clone of the full root document (nested `networks` included).
- Skill host (`assets/host/`): **basic by default** (`opts.editing === true` only when requested); ⋯ **Edit mode** toggles full edit; Copy/Download use `exportDocument()` → `toRootJSON()`. Reset keeps the current edit flag.

Constructor `defaultInteractions` behavior is unchanged until the first `setEditing` call (demo packs stay intact).

## Alternatives considered

**Host remount on toggle.** Rejected: drops camera/selection; unnecessary once detach/reattach works.

**Always attach edit interactions; lock all nodes when browsing.** Rejected: does not cover edge bend / create, and pollutes the document with `locked`.

**Change `toJSON()` to always return the root.** Rejected: chrome and expand-all need the active layer; callers already treat `toJSON` as active.

## Consequences

- Delivered topo pages must refresh `host.js` + rebundled `aitopo.iife.js` to get Edit mode and correct nested downloads.
- Pinned contract documents `setEditing` / `toRootJSON` on `Network`; no new global interaction class exports required for the stock host.

## Testing

- `tests/scene-graph.spec.ts`: nested `toRootJSON` includes flushed leaf under `networks`.
- `tests/network-edit-mode.spec.ts`: `setEditing` browse does not move; edit moves and exposes bend path via editing flag.
- `tests/topo-diagram-skill-bundle.spec.ts`: IIFE still lists contract symbols.

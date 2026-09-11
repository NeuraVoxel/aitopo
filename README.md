# `@neuravoxel/aitopo`

Canvas topology engine for AI graphs (fleet, flow, teams, custom kinds).

Humans and models share a versioned **Document / Patch / Events** protocol. Internally a lean Scene + View layer drives a pluggable **Renderer** (Canvas 2D first) with dirty-rect paint.

## Design

- Dual-face architecture and phase plan: [docs/2026-09-07-aitopo-design.md](docs/2026-09-07-aitopo-design.md)
- Implementation checklist: [docs/2026-09-07-aitopo-implementation-plan.md](docs/2026-09-07-aitopo-implementation-plan.md)
- Editor milestone (orchestrator): [docs/2026-09-08-aitopo-editor-requirements.md](docs/2026-09-08-aitopo-editor-requirements.md)
- Editor implementation plan: [docs/2026-09-09-aitopo-editor-implementation-plan.md](docs/2026-09-09-aitopo-editor-implementation-plan.md)
- twaver.vector gap backlog: [docs/2026-09-09-aitopo-twaver-vector-gap.md](docs/2026-09-09-aitopo-twaver-vector-gap.md)
- Wave A (View / Renderer / alarmChanged): [.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md](.agents/notes/implemented/architecture/2026-09-10-wave-a-view-renderer-alarms.md)
- Wave B (overlay chrome / lazy move / drop-target): [.agents/notes/implemented/architecture/2026-09-10-wave-b-overlay-lazy-move.md](.agents/notes/implemented/architecture/2026-09-10-wave-b-overlay-lazy-move.md)
- Wave C (marquee append / resize): [.agents/notes/implemented/architecture/2026-09-10-wave-c-marquee-resize.md](.agents/notes/implemented/architecture/2026-09-10-wave-c-marquee-resize.md)
- Wave D (orchestrator F1 chrome): [.agents/notes/implemented/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md](.agents/notes/implemented/architecture/2026-09-10-wave-d-orchestrator-f1-chrome.md)
- Wave E (scene vs overlay paint channels): [.agents/notes/implemented/architecture/2026-09-11-wave-e-paint-channels.md](.agents/notes/implemented/architecture/2026-09-11-wave-e-paint-channels.md)
- Wave F (apply / preview dirty granularity): [.agents/notes/implemented/architecture/2026-09-11-wave-f-dirty-granularity.md](.agents/notes/implemented/architecture/2026-09-11-wave-f-dirty-granularity.md)
- Wave G (View label / alarm / hit facets): [.agents/notes/implemented/architecture/2026-09-11-wave-g-view-facets.md](.agents/notes/implemented/architecture/2026-09-11-wave-g-view-facets.md)
- Wave H (GestureEditor / OverlayChromeRegistry): [.agents/notes/implemented/architecture/2026-09-11-wave-h-gesture-editor.md](.agents/notes/implemented/architecture/2026-09-11-wave-h-gesture-editor.md)
- Wave I (edge bend waypoints): [.agents/notes/implemented/architecture/2026-09-11-wave-i-move-edge-bend.md](.agents/notes/implemented/architecture/2026-09-11-wave-i-move-edge-bend.md)
- GraphNode attachments (label/label2/icon/tooltip): [.agents/notes/implemented/architecture/2026-09-11-graph-node-attachments.md](.agents/notes/implemented/architecture/2026-09-11-graph-node-attachments.md)
- Performance roadmap (Waves J–N, proposed): [.agents/notes/proposed/architecture/2026-09-11-performance-roadmap.md](.agents/notes/proposed/architecture/2026-09-11-performance-roadmap.md)

Design ideas come from `twaver.vector` at `/home/jeff/Documents/AI/coding-agent/SDK2D` (not shipped here). This package is a **clean-room** TypeScript rewrite: no SDK2D imports, no twaver public API names.

## Status

Peer repository (`NeuraVoxel/aitopo`, private). deepseek-harness consumes this engine via git submodule (then npm). Engine + vanilla demo ship Editor interactions (move, drop, marquee, optional undo). Session UI adapters (`agent-observe`) stay in deepseek-harness.

Agent workflow uses `@neuravoxel/ai-eng` as a committed `devDependency` (`github:NeuraVoxel/ai-eng-kit#…`; see [AGENTS.md](AGENTS.md)). After `pnpm install`, run `pnpm run verify-notes`. Bump the kit commit when upgrading process gates. CI needs repository secret `AI_ENG_KIT_TOKEN` (read access to the private kit) so `pnpm install` can fetch that GitHub dependency.

## Commands

```sh
pnpm install
pnpm test
pnpm run typecheck
pnpm run demo
pnpm run verify-notes
```

## Public API (summary)

```ts
import {
  Network,
  parseDocument,
  applyPatch,
  PatchHistory,
  MoveEdgeBendInteraction,
  MoveNodeInteraction,
  ResizeNodeInteraction,
  ExternalDropInteraction,
  MarqueeSelectInteraction,
} from '@neuravoxel/aitopo'

const network = new Network({
  // Extra interactions are appended to defaults (PanZoom + SelectActivate).
  interactions: [
    new ExternalDropInteraction(),
    new MoveEdgeBendInteraction(),
    new ResizeNodeInteraction(),
    new MoveNodeInteraction(),
    new MarqueeSelectInteraction(),
  ],
})
network.mount(el)
network.load(parseDocument(json))
network.apply(patch)
network.on(event => { /* GraphEvent */ })
network.destroy()
```

Pass `defaultInteractions: false` to attach only the listed modules (tests / custom packing).

## Editor interactions

| Class | Role |
|---|---|
| `MoveNodeInteraction` | Drag unlocked selected nodes; commit `updateNode` (+ membership); emit `nodeMoved` / `groupMembershipChanged`. Options: `hideOthersWhileDragging`, `lazyMove` |
| `MoveEdgeBendInteraction` | Bend handles on selected edges; axis-constrained drag; commit `updateEdge` `waypoints`; emit `edgeWaypointsChanged`. Pack **before** `MoveNodeInteraction` |
| `ResizeNodeInteraction` | Corner handles on selected unlocked nodes; commit `updateNode` x/y/w/h; emit `nodeResized`. Pack **before** `MoveNodeInteraction` |
| `CreateEdgeInteraction` | **Alt+drag** node→node (or `requireAlt: false` exclusive link mode); rubber-band; `commitEdgeCreate` → `edgeCreated` |
| `DeleteEdgeInteraction` | Delete/Backspace removes selected edges → `edgeRemoved` |
| `ExternalDropInteraction` | HTML5 drop → opaque `externalDrop` (engine does **not** `addNode`) |
| `MarqueeSelectInteraction` | **Shift+empty-space** drag; intersect select; **Ctrl/Meta** at pointer-up appends; unmodified empty drag stays pan |

### Events

- `nodeMoved` — `{ nodeId, from, to }` after pointer-up commit
- `nodeResized` — `{ nodeId, from, to }` bounds after resize commit
- `groupMembershipChanged` — `{ nodeId, fromGroupId, toGroupId }` when membership changes
- `externalDrop` — `{ x, y, data, groupId? }` scene coords + opaque string
- `edgeCreated` — `{ edgeId, from, to, kind? }` after Alt-link (or link mode) commit
- `edgeRemoved` — `{ edgeId }` after Delete/Backspace or `commitEdgeRemove`
- `edgeWaypointsChanged` — `{ edgeId, from, to }` waypoint lists after bend commit

### Protocol fields

- `GraphNode.locked?: boolean` — move and membership edits skip locked nodes (selection still allowed)
- `GraphEdge.waypoints?: { x, y }[]` — intermediate bend points; absent or `[]` = auto orthogonal route
- `GraphGroup.style?: { stroke?, strokeWidth?, strokeDash?, fill? }` — Canvas2D band outline (e.g. dashed green composition vs solid gray catalog)

### Drop MIME types

`ExternalDropInteraction` reads `text/plain` first, then `application/aitopo-drop` when plain is empty. Hosts should set both when possible.

### Undo / redo

Optional `PatchHistory` records forward/inverse `GraphPatch` pairs around `apply` / `toJSON`. Hosts may ignore it and own their own stack. The vanilla demo wires Undo/Redo only in **Editor** mode.

### Demo

- **Fleet / Flow / Teams** — observation mode (defaults only); unchanged behavior.
- **Editor** — remounts with editor interactions, loads `fixtures/editor.json` (sample **data/control** edges), select edge → drag bend handles, Alt+drag to link, Delete edge / Delete key, **Link mode**, **Kind** toggle, **Hide others** (default off — full scene paint), drop catalog chip, Undo/Redo via `PatchHistory`.

## Non-goals (current)

- React bindings (plugin adapter later)
- WebGL renderer (interface reserved)
- Overview / HTML node UI
- Copying or wrapping `/home/jeff/Documents/AI/coding-agent/SDK2D`
- Rotate handles; freeform (non-orthogonal) edge polylines

Editor requirements and decisions: [Editor requirements](docs/2026-09-08-aitopo-editor-requirements.md), [Editor plan](docs/2026-09-09-aitopo-editor-implementation-plan.md). Implementation borrows **ideas** from `/home/jeff/Documents/AI/coding-agent/SDK2D/twaver/vector/` under the same clean-room rules as the observation engine.

## Known Limitations and Deferred Work

- SubNetwork drill-down is single-level (root ↔ one child).
- Alarm badges cover display only; no propagation tree; `setAlarms` emits `alarmChanged`.
- Pan/zoom triggers full-frame invalidate; element edits use dirty-rect.
- Selection / hover / overlay chrome use overlay-only paint (`requestOverlayPaint`); `apply` and live move/resize preview use dirty-rect when possible (Wave F).
- Selected/hovered nodes use overlay rings; root body stroke no longer turns blue for select/hover.
- Open **Debug dirty** while dragging a node in Editor: red rects should track the mover (not full-frame) when Hide others is off.
- Performance follow-ups (demand rAF, culling, pan ladder, spatial hit, gated WebGL): [performance roadmap](.agents/notes/proposed/architecture/2026-09-11-performance-roadmap.md) (proposed; not implemented).

Full per-module status vs `twaver.vector`: [docs/2026-09-09-aitopo-twaver-vector-gap.md](docs/2026-09-09-aitopo-twaver-vector-gap.md).

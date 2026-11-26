# Agent Note: AITopo demo showcase shell

Status: implemented

## Problem

The vanilla `demo/` is a flat toolbar that loads Fleet / Flow / Teams / Editor fixtures. It does not teach the engine element-by-element, has no sample catalog, no property inspector with write-back, and mixes observation fixtures with editor controls in one crowded chrome. Hosts (and new contributors) need a showcase shell: left sample list, top interaction modes, center `Network`, right properties.

## Decision

The demo entry is a **Vite + React** Classic IDE shell that mounts the existing `Network` API. Scope is demo-only; the published engine stays framework-agnostic.

### Layout (Classic IDE)

CSS grid: toolbar / body / status (`auto 1fr auto`); body columns `240px | 1fr | 280px`. Neutral slate toolbar (`#0f172a`).

- **Top toolbar** — Observe / Edit / Create Node / Create Link / Create Path / Create ShapeNode, Undo/Redo, Debug, Enter team-a / Exit subnet
- **Left nav** — sample catalog by group
- **Center** — canvas host for `Network`
- **Right panel** — selection properties (editable subset)
- **Bottom status** — mode / selection / last event summary

### Interaction modes

Mutually exclusive primary mode:

| Mode | Behavior |
|------|----------|
| Observe (default) | Defaults only: `PanZoom` + `SelectActivate` |
| Edit | Adds move / resize / bend / path·shape vertex / marquee / delete edge, path, or shapeNode; Alt+drag link; `PatchHistory` for Undo/Redo |
| Create Node | Click empty canvas → `addNode` at world point |
| Create Link | Exclusive link mode (`CreateEdgeInteraction` with `requireAlt: false`) |
| Create Path | Exclusive path mode (`CreatePathInteraction`); Delete removes selected paths |
| Create ShapeNode | Exclusive shape-node mode (`CreateShapeNodeInteraction`); Delete removes selected shapeNodes |
| Edit (paths / shapeNodes) | `MovePathVertexInteraction` then `MoveShapeNodeVertexInteraction` first among extras; body move via default `MoveNode`; Delete removes paths / shapeNodes |

Independent: **Debug** toggles `setDebugPaintRects`. Undo/Redo is enabled when history is active (Edit and create modes). Switching samples or modes recreates `Network` (clears history) then `load` + optional layout + `fitContent`. Status shows sample title plus a mode hint. `Network.on('subNetworkChanged')` clears `PatchHistory`, resets undo/redo flags, and `setSelection([])` so PropertyPanel does not keep parent-network ids. Undo/redo apply failures become status text.

### Sample catalog

Registry-driven entries (`id`, title, group, description, document or factory, optional `defaultLayout`).

1. **Elements** — `hello-world` (default: two nodes, one edge), then one page each: Node, Edge, Path, ShapeNode, Group, Alarm, SubNetwork. There is no separate Started group.
2. **Business (soon)** — placeholders such as `dsh-event-topo` (disabled; click shows reserved message only).

Fleet / Flow / Teams / Editor are not primary toolbar entries. `fixtures/*.json` remain for engine tests.

### Property panel (write-back level A)

Single selection only. Editable via `updateNode` / `updateEdge` / `updateGroup` through `PatchHistory` on blur/Enter: label; geometry `x/y/w/h` where applicable; node `type`; common style fields (fill, stroke, strokeWidth, labelPosition, label color/fontSize; edge kind); simple string `data` map. Read-only: id, alarms summary, membership / from–to summaries. No alarm list editor, waypoint editor, multi-select batch edit, or edge arrow fields.

### Demo module layout

```
demo/
  main.tsx, App.tsx, index.html, vite.config.ts, styles.css
  components/ SampleNav, Toolbar, PropertyPanel, StatusBar, CanvasHost
  samples/ registry + elements/* (incl. hello-world) + business/placeholders
  hooks/useNetworkDemo.ts
  lib/interactions.ts, property-patch.ts, subnetwork-session.ts
  tsconfig.json
```

`react` / `react-dom` (+ types) and `@vitejs/plugin-react` ^4.x (Vite 6) are demo `devDependencies`. `pnpm run demo` is unchanged. `pnpm run typecheck` runs `tsc -p tsconfig.json --noEmit` then `tsc -p demo/tsconfig.json --noEmit` so demo TSX is checked without folding `demo/` into the engine program.

## Alternatives considered

- **Vanilla shell only:** rejected — property forms and nav state are heavier without a UI library; product choice was React.
- **Preact:** rejected — React chosen for familiarity with deepseek-harness client patterns.
- **Imperative DemoHost + React chrome only:** rejected — dual state sync costs more than a single React app with a thin Network hook.
- **Multi-route sample pages:** rejected — breaks shared toolbar/modes/properties when switching samples.
- **Ship business topologies in the same change:** deferred — catalog placeholders only (`dsh-event-topo` etc.).
- **Full property editor (alarms, waypoints, multi-select, edge arrows):** deferred — write-back level A only.
- **Keep PatchHistory and React selection across SubNetwork enter/exit:** rejected — inverses target the previous network, and scene selection retains parent ids that PropertyPanel then shows as missing.
- **Fold `demo/` into the root `tsconfig.json` include:** rejected — engine emit uses `rootDir: src`; a separate `demo/tsconfig.json` keeps that program isolated.
- **IDE layout B (nav rail + bottom props) or C (floating edit tools):** rejected after layout review; Classic IDE (A) won.

## Consequences

- React adds demo dependency weight and a Vite JSX path; it stays demo-scoped so the library package remains framework-agnostic.
- Recreating `Network` on every sample/mode remount drops transient UI state; acceptable for a showcase (status bar reports load / reserved / subnet messages).
- Create Node by click has no first-class engine interaction (no `CreateElement`); the host uses pointer + `addNode`. Mode exclusivity tears down conflicting interactions on remount.
- Edge arrow fields stay off the property panel (deferred from level A).
- Enter/Exit subnet lives on the Toolbar (`Enter team-a` / `Exit subnet`), not the property panel. Successful navigation drops undo/redo for the previous network.
- Optional catalog drag-drop chrome did not ship; Edit and Create Node still attach `ExternalDropInteraction` for host drops.
- Status bar appends a short mode hint after the sample title (e.g. Create Path instructions).

## Testing

- Default load is `hello-world` (two nodes, one edge).
- `tests/demo-registry.spec.ts` — catalog groups, default id, reserved business rows do not load documents.
- `tests/demo-property-patch.spec.ts` — single-select write-back ops for node/edge/group; invalid `dataJson` / `labelPosition` throw.
- `tests/demo-subnetwork-session.spec.ts` — `subNetworkChanged` helper clears `PatchHistory` and selection; undo/redo apply errors become status text.
- Observe / Edit / Create Node / Create Link / Create Path / Create ShapeNode / Debug / Undo / Redo / Enter–Exit subnet are host-wired; engine unit tests stay green (`pnpm test`).
- `pnpm run typecheck` covers `src` and `demo`.

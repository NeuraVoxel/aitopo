# Agent Note: AITopo demo showcase shell

Status: proposed

## Problem

The vanilla `demo/` is a flat toolbar that loads Fleet / Flow / Teams / Editor fixtures. It does not teach the engine element-by-element, has no sample catalog, no property inspector with write-back, and mixes observation fixtures with editor controls in one crowded chrome. Hosts (and new contributors) need a showcase shell: left sample list, top interaction modes, center `Network`, right properties.

## Proposal

Replace the demo entry with a **Vite + React** shell that mounts the existing `Network` API. Scope is demo-only; no engine API redesign.

### Layout (Classic IDE)

- **Top toolbar** — interaction modes and Debug
- **Left nav** — sample catalog by group
- **Center** — canvas host for `Network`
- **Right panel** — selection properties (editable subset)
- **Bottom status** — mode / selection / last event summary

### Interaction modes

Mutually exclusive primary mode:

| Mode | Behavior |
|------|----------|
| Observe (default) | Defaults only: `PanZoom` + `SelectActivate` |
| Edit | Adds move / resize / bend / marquee / delete edge; `PatchHistory` for Undo/Redo |
| Create Node | Click empty canvas → `addNode` at world point; optional catalog drag-drop |
| Create Link | Exclusive link mode (`CreateEdgeInteraction` with `requireAlt: false`) |

Independent: **Debug** toggles `setDebugPaintRects`. Undo/Redo enabled when history is active (Edit and create modes that push patches). Switching samples recreates `Network` (clear history) then `load` + optional layout + `fitContent`.

### Sample catalog

Registry-driven entries (`id`, title, group, description, document or factory, optional `defaultLayout`).

1. **Getting started** — `hello-world` (default): two nodes, one edge, explicit coordinates (no layout).
2. **Elements** — one page each: Node, Edge, Group, Alarm, SubNetwork (features and styles for that element).
3. **Business (soon)** — placeholders such as `dsh-event-topo` (disabled; click shows reserved message only).

Legacy Fleet / Flow / Teams / Editor toolbar buttons are removed as primary entry; useful fragments may fold into Element samples.

### Property panel (write-back level A)

Single selection only. Editable via `updateNode` / `updateEdge` / `updateGroup` through `PatchHistory` on blur/Enter: label; geometry `x/y/w/h` where applicable; node `type`; common style fields (fill, stroke, strokeWidth, labelPosition, label color/fontSize; edge kind/arrows); simple string `data` map. Read-only: id, alarms summary, membership / from–to summaries. No alarm list editor, waypoint editor, or multi-select batch edit in this proposal.

### Demo module layout

```
demo/
  main.tsx, App.tsx, index.html, vite.config.ts
  components/ SampleNav, Toolbar, PropertyPanel, StatusBar, CanvasHost
  samples/ registry + hello-world + elements/* + business/placeholders
  hooks/useNetworkDemo.ts
```

Add `react` / `react-dom` (+ types) as demo dependencies. Keep `pnpm run demo`.

## Alternatives considered

- **Vanilla shell only:** rejected — property forms and nav state are heavier without a UI library; product choice was React.
- **Preact:** rejected — React chosen for familiarity with deepseek-harness client patterns.
- **Imperative DemoHost + React chrome only:** rejected — dual state sync costs more than a single React app with a thin Network hook.
- **Multi-route sample pages:** rejected — breaks shared toolbar/modes/properties when switching samples.
- **Ship business topologies in the same change:** deferred — catalog placeholders only (`dsh-event-topo` etc.).
- **Full property editor (alarms, waypoints, multi-select):** deferred — write-back level A only.
- **IDE layout B (nav rail + bottom props) or C (floating edit tools):** rejected after layout review; Classic IDE (A) won.

## Acceptance criteria

- Default load shows `hello-world` (two nodes, one edge).
- Left nav switches Element samples; Business placeholders do not load documents.
- Observe / Edit / Create Node / Create Link / Debug / Undo / Redo behave as in Proposal.
- Single-select property edits update the canvas and are undoable when history is active.
- Engine unit tests remain green; demo verified manually (optional registry unit smoke).
- Agent Note lives under `.agents/notes/`; `.superpowers/` stays out of git.

## Risks

- React adds demo dependency weight and a Vite JSX path; keep it demo-scoped so the library package stays framework-agnostic.
- Recreating `Network` on every sample/mode remount can lose transient UI state; acceptable for a showcase, document in status bar if needed.
- Create Node by click has no first-class engine interaction yet (gap: CreateElement); host implements via pointer + `addNode` / existing drop path — risk of UX inconsistency with Edit move handlers; mode exclusivity must tear down conflicting interactions.

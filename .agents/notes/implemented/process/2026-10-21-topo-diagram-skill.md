# Agent Note: Installable topo-diagram skill (aitopo-backed + SVG dual track)

Status: implemented

## Problem

Agents already have a strong HTML/SVG diagram skill (`diagram-design`) for forty-odd visual types, but it cannot express this repository's topology strengths: Group expand/collapse with agent-link remapping ("穿透"), SubNetwork drill-down, and light interactive edit of a live graph. Authors who want those behaviors must hand-write `GraphDocument` JSON and wire a host; there is no installable skill that teaches routing, dialect, style, and a self-contained browse page. Conversely, forcing every diagram type through Canvas topology would poorly serve radar, Gantt, Venn, and similar geometric/statistical charts.

## Decision

Ship an installable **topo-diagram** skill under `.agents/skills/topo-diagram/`: style-guide + type routing + GraphDocument dialect + vendored `aitopo` IIFE (`assets/aitopo.iife.js`, global `Aitopo`) + minimal host template. Structure/flow diagrams use the engine; statistical/geometric types use an in-skill SVG/HTML subset (or defer to `diagram-design`). Consumers install by copying the skill tree. Rebuild the IIFE with `pnpm run bundle:topo-diagram-skill`.

### Intent

| Item | Choice |
|---|---|
| Deliverable | `GraphDocument` JSON **and** a minimal browsable page |
| Type coverage | Aim at the diagram-design catalog |
| Poor topo fit | Dual track: SVG/HTML in-skill, or explicit defer |
| Form factor | Installable general-purpose skill |
| Runtime | Skill ships a bundled aitopo JS file |
| Host interaction | Light edit: pan/zoom, group collapse, SubNetwork enter/exit, drag nodes, Alt+drag create edges, `toJSON` |
| Visual system | Independent style-guide + first-diagram onboarding; shared semantic colors across tracks |

### Package layout

```
.agents/skills/topo-diagram/
  SKILL.md
  references/
    style-guide.md
    semantic-patterns.md
    routing.md
    dialect-graph-document.md
    host.md
  assets/
    aitopo.iife.js
    host/
      index.html
      host.js
      sample.graph.json
    svg/
      quadrant.example.html
  scripts/
    bundle-entry.ts
    bundle-aitopo.mjs
```

### Boundaries

**Skill owns:** teaching agents to route types, author documents, apply style tokens, fill the host template, and (for SVG track) emit self-contained HTML/SVG.

**Skill does not own:** engine features still deferred in aitopo (multi-level SubNetwork stacks), full demo IDE / property panel, first-class PNG/SVG export APIs, or a complete port of all diagram-design visual grammars. Nested groups are engine-supported (`parentId`); skill prefers ≤1 nesting level.

**Skill vs engine (global):** Prefer **keeping aitopo source and demo defaults unchanged**. Apply skill look via supported params in dialect / host / emitted JSON. Unsupported capability → **aitopo requirement** (propose → implement with clean-room `twaver.vector` reference → rebundle). Do not change global engine defaults only to restyle the skill, fake features in the skill tree, or hand-edit `assets/aitopo.iife.js`. SVG / defer stays for honest non-topo asks.

### Type routing

| Track | Typical types | Output |
|---|---|---|
| **topo** | Architecture, architecture delta, nested, tree/org, dependency, data flow, flowchart, swimlane (groups as lanes), deployment, IT current-state; sequence/state as weak mappings | `*.graph.json` + filled host HTML |
| **svg** | Radar, polar, heatmap, bar/dumbbell, waterfall, Gantt, scatter, Venn, quadrant, pure timeline, pyramid/funnel, treemap, … | Self-contained HTML/SVG using the same style-guide tokens |
| **defer** | Types not yet ported (e.g. complex axonometric, rich Wardley) | Refuse with one-line reason; point to `diagram-design` or a listed substitute |

Prefer **topo** when meaning depends on containment, cross-boundary links, or drill-down.

### GraphDocument dialect (topo track)

1. Stable readable `id`s; small `type` vocabulary (`component`, `actor`, `state`, `layer`, `portal`, …); business detail in `data`.
2. Edges carry non-obvious relationships; use `kind`: `flow` | `dep` | `parent` | `msg`.
3. Groups are visual scopes: `groups[]` + `memberIds` + member `groupId`. Structure diagrams **set `expanded: true` explicitly** (engine default when omitted is collapsed).
4. Cross-group "穿透": edges keep `from`/`to` on **member** ids; remapping on collapse is view-time only (see [group attachments](../../implemented/architecture/2026-09-12-graph-group-attachments.md)). No protocol field for penetration.
5. Drill-down: `networkId` + `networks[id]`; portal nodes; single level root ↔ child only.
6. Layout: write `x`/`y` when known; else host calls `network.layout('grid' | 'flowColumns')` after load. Target density ~4/10; prefer ≤9 focal nodes or split / drill down.
7. Styles map only style-guide semantic roles (focal / muted / accent) into `Graph*Style` — no ad-hoc hex in agent output.
8. `meta.kind` is only `topology` | `flow` | `custom` (protocol enum).
9. **Label principle (skill styles):** authors set node `center` + bold, group `insideTop` + bold + `paddingTop`, subtitle `insideBottom` (engine stacks under title when those positions are set). Third title = `alarms[]` + `alarmVariant: "tag"` + `alarmPosition: "insideTopLeft"` (engine default remains severity `dot` at `topRight`). Protocol supports `insideBottom`, `fontWeight`, `paddingTop`, `alarmPosition` / `alarmVariant` / `style.alarm`. Topo host sets `showNodeIcons: false`.
10. **Link principle:** orthogonal (横平竖直) first — omit `waypoints` for aitopo auto-route; pin sides with anchors; every elbow / special polyline stays axis-aligned. Edge labels use `style.labelSide: "aboveOrRight"` (horizontal → above, vertical → right); engine default remains `pathLeft`. No skill-side freeform/curve or host-drawn labels; richer link types → aitopo requirement (+ twaver clean-room), then rebundle.

### Host page and light-edit API

`assets/host/` embeds a `GraphDocument`, loads `aitopo.iife.js` + `host.js`, and exposes `TopoDiagramHost`. `Network` uses defaults **plus** `CreateEdgeInteraction` (`kind: 'flow'`, Alt+drag). Default page chrome: **top bar** with title (`meta.title` / `meta.eyebrow`), **legend** (`#legend`), and a far-right **⋯** menu (Fit view · Expand/Collapse · Copy/Download · Reset); canvas below fills the remaining viewport and **`fitContent`s on load / resize / reset**. Outside click / Escape closes the menu. No property panel, no Undo UI.

**Pinned host contract symbols:** `Network`, `parseDocument`, `CreateEdgeInteraction`, `layoutGrid`, `layoutFlowColumns`. Golden sample: `sample.graph.json` (two expanded groups, cross edge `cross`, SubNetwork `detail`).

### Style-guide and bundle

Style tokens and first-diagram gate live in `references/style-guide.md`. Bundle header records engine semver, git sha, pack date, and contract symbols. Never hand-edit the IIFE. Skill `metadata.version` / `metadata.aitopo` track the paired engine version.

### v1 non-goals

Nested groups; multi-level SubNetwork; PNG/SVG export API; full 45-type SVG grammar; host Undo UI / property panel.

## Alternatives considered

- **Thin skill (dialect only, no vendored JS / host):** Rejected — fails the agreed "open anywhere" browse page and bundled runtime.
- **Dual skills (`topo-diagram` + keep relying on `diagram-design` for all non-topo):** Rejected as the primary shape — splits style onboarding and mental model; defer-to-diagram-design remains only for unported types.
- **Hard-map every type into GraphDocument:** Rejected — dishonest for statistical/geometric charts.
- **Detect local `@neuravoxel/aitopo` / CDN instead of shipping an IIFE:** Rejected — user chose a skill-owned bundle for portability and version pinning.
- **Full demo IDE host:** Rejected — out of scope for light edit; property panel and create-mode IDE stay in this repo's demo app.
- **Default `expanded: true` in the engine:** Out of scope for this skill; authors set `expanded: true` in documents. Engine default remains collapsed per [group attachments](../../implemented/architecture/2026-09-12-graph-group-attachments.md).

## Consequences

- Skill installs carry ~170 KiB of minified engine JS and must rebundle when host-contract APIs change.
- Host must not depend on non-contract exports even when the demo app uses richer APIs.
- SVG track is intentionally thin (quadrant example + routing tables); unported types defer rather than fake a topo mapping.
- Shipping the engine inside a copiable skill follows the package MIT license; redistributors must keep that notice with the bundle header.
- Sequence/state on topo remain weak; `routing.md` steers geometric charts to svg/defer.

## Testing

- `tests/topo-diagram-skill-bundle.spec.ts` — `parseDocument` on golden sample (expanded groups, cross edge, SubNetwork) and IIFE header/contract symbol presence.
- Manual: serve `assets/host/index.html` and exercise collapse (cross-edge remap), portal enter/exit, drag, Alt+drag link, Copy JSON.
- `pnpm run verify-notes` after note moves.

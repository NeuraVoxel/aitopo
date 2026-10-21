# Topo-Diagram Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan location note:** This repository places planning artifacts under `.agents/plans/` (not `docs/superpowers/plans/`) per `AGENTS.md`.

**Goal:** Ship an installable `topo-diagram` skill with vendored aitopo IIFE, light-edit host, GraphDocument dialect/routing/style-guide, and a smokeable sample page.

**Architecture:** Skill lives at `.agents/skills/topo-diagram/`. A Vite IIFE build emits `assets/aitopo.iife.js` exposing global `Aitopo` with the pinned host contract. Host template loads a golden `GraphDocument`, enables defaults + `CreateEdgeInteraction`, and exports JSON. References teach routing (topo/svg/defer) and dialect.

**Tech Stack:** Existing Vite 6 + TypeScript; skill Markdown; vanilla host HTML/JS (no React).

**Spec:** `.agents/notes/proposed/process/2026-10-21-topo-diagram-skill.md`

## Global Constraints

- Do not change engine protocol for nested groups or multi-level SubNetwork.
- Host may only rely on contract symbols: `Network`, `parseDocument`, `CreateEdgeInteraction`, `layoutGrid` / `layoutFlowColumns` / `network.layout`, `GraphDocument`.
- Structure-diagram samples set `expanded: true` explicitly.
- Create edge = Alt+drag (engine default `requireAlt: true`); document this in `host.md` and the sample HTML.
- Never hand-edit `aitopo.iife.js`; only regenerate via script.
- Do not auto-commit unless the user asks.
- Keep Agent Note in `proposed/` until the skill tree + bundle + smoke sample land; then promote to `implemented/` in the same change that finishes Task 5.

## File map

| Path | Responsibility |
|------|----------------|
| `.agents/skills/topo-diagram/SKILL.md` | Skill entry: when to use, workflow, gates |
| `.agents/skills/topo-diagram/references/style-guide.md` | Tokens + first-diagram gate |
| `.agents/skills/topo-diagram/references/routing.md` | Type → topo \| svg \| defer |
| `.agents/skills/topo-diagram/references/dialect-graph-document.md` | Authoring rules + style role map |
| `.agents/skills/topo-diagram/references/host.md` | Host contract + gestures |
| `.agents/skills/topo-diagram/references/semantic-patterns.md` | Short pattern table (topo-relevant) |
| `.agents/skills/topo-diagram/assets/host/index.html` | Browsable sample page |
| `.agents/skills/topo-diagram/assets/host/host.js` | boot / toolbar / toJSON |
| `.agents/skills/topo-diagram/assets/host/sample.graph.json` | Golden doc (group + cross edge + portal) |
| `.agents/skills/topo-diagram/assets/aitopo.iife.js` | Generated bundle |
| `.agents/skills/topo-diagram/scripts/bundle-entry.ts` | Contract re-exports for IIFE |
| `.agents/skills/topo-diagram/scripts/bundle-aitopo.mjs` | Vite build → assets |
| `.agents/skills/topo-diagram/assets/svg/quadrant.example.html` | One SVG-track example |
| `package.json` | Add `bundle:topo-diagram-skill` script |
| `.agents/notes/proposed/process/2026-10-21-topo-diagram-skill.md` → `implemented/` | Promote after ship |

---

### Task 1: Bundle entry + IIFE build script

**Files:**
- Create: `.agents/skills/topo-diagram/scripts/bundle-entry.ts`
- Create: `.agents/skills/topo-diagram/scripts/bundle-aitopo.mjs`
- Modify: `package.json` (add script)
- Create: `.agents/skills/topo-diagram/assets/aitopo.iife.js` (generated)

**Interfaces:**
- Produces: global `Aitopo` with `{ Network, parseDocument, CreateEdgeInteraction, layoutGrid, layoutFlowColumns }`

- [ ] **Step 1: Write bundle entry**

```ts
// .agents/skills/topo-diagram/scripts/bundle-entry.ts
export {
  Network,
  parseDocument,
  CreateEdgeInteraction,
  layoutGrid,
  layoutFlowColumns,
} from '../../../src/index.ts'
```

- [ ] **Step 2: Write Vite IIFE builder**

`bundle-aitopo.mjs` uses `vite.build` with `build.lib` entry = bundle-entry, `formats: ['iife']`, `name: 'Aitopo'`, `fileName: () => 'aitopo.iife.js'`, `outDir` = `assets/`, `emptyOutDir: false`. Prepend a header comment with package version from root `package.json`, `git rev-parse --short HEAD`, ISO date, and the contract symbol list. Fail if git sha cannot be read (use `unknown` only if not a git checkout — prefer real sha).

- [ ] **Step 3: Add npm script and run build**

```json
"bundle:topo-diagram-skill": "node .agents/skills/topo-diagram/scripts/bundle-aitopo.mjs"
```

Run: `pnpm run bundle:topo-diagram-skill`  
Expected: `.agents/skills/topo-diagram/assets/aitopo.iife.js` exists and contains `Aitopo` / `Network`.

- [ ] **Step 4: Smoke the global in Node**

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('.agents/skills/topo-diagram/assets/aitopo.iife.js','utf8'); if(!s.includes('Aitopo')||!s.includes('CreateEdgeInteraction')) process.exit(1)"
```

Expected: exit 0.

---

### Task 2: Host template + golden GraphDocument

**Files:**
- Create: `.agents/skills/topo-diagram/assets/host/sample.graph.json`
- Create: `.agents/skills/topo-diagram/assets/host/host.js`
- Create: `.agents/skills/topo-diagram/assets/host/index.html`

**Interfaces:**
- Consumes: `globalThis.Aitopo` from Task 1
- Produces: `boot(doc)`, toolbar actions, `exportDocument()`

- [ ] **Step 1: Write golden document**

`sample.graph.json`: `version: 1`; two groups (`alpha`, `beta`) each with 2 nodes `expanded: true`; one cross-group edge (`a2`→`b1`); one outside node; one portal node with `networkId: 'detail'` and `networks.detail` with 2 nodes + 1 edge. Explicit coordinates. Cross-edge demonstrates penetration when groups are collapsed.

- [ ] **Step 2: Write `host.js`**

```js
/* global Aitopo */
export function createHost(container, doc, opts = {}) {
  const { Network, parseDocument, CreateEdgeInteraction } = Aitopo
  const network = new Network({
    interactions: [new CreateEdgeInteraction({ kind: 'flow' })],
  })
  network.mount(container)
  network.load(parseDocument(doc))
  if (opts.layout) network.layout(opts.layout)
  return {
    network,
    exportDocument: () => network.toJSON(),
    setAllGroupsExpanded(expanded) { /* updateGroup each group */ },
    reset(initial) { network.load(parseDocument(initial)) },
    destroy() { network.destroy() },
  }
}
```

Use non-module script pattern if HTML is file:// friendly: attach `window.TopoDiagramHost = { boot(...) }` without ES modules so opening `index.html` via file or simple static server works. Prefer IIFE host that reads `#diagram-data` JSON script tag.

Toolbar: Expand all / Collapse all / Copy JSON / Download JSON / Reset.  
Hint text: Alt+drag to link; double-click group to toggle; double-click portal to enter; double-click empty to exit.

- [ ] **Step 3: Write `index.html`**

Load `../aitopo.iife.js`, then `host.js`, embed sample JSON in `<script type="application/json" id="diagram-data">`, full-viewport canvas host, toolbar. Title: `topo-diagram sample`.

- [ ] **Step 4: Manual/automated open check**

Serve with `npx --yes serve .agents/skills/topo-diagram/assets -p 4177` (or python http.server) and confirm no console throw on load — or use happy-dom smoke in Task 5.

---

### Task 3: Skill references + SKILL.md

**Files:**
- Create: `.agents/skills/topo-diagram/references/*.md` (style-guide, routing, dialect, host, semantic-patterns)
- Create: `.agents/skills/topo-diagram/SKILL.md`
- Create: `.agents/skills/topo-diagram/assets/svg/quadrant.example.html`

**Interfaces:**
- Produces: agent-facing workflow matching the spec

- [ ] **Step 1: style-guide.md** — paper `#f5f5f5`, ink `#2d3142`, accent `#bf4520`, muted, focal; first-diagram gate text; role→color table.

- [ ] **Step 2: routing.md** — tables for topo / svg / defer covering the diagram-design-scale catalog; prefer topo for containment/cross-boundary/drill-down.

- [ ] **Step 3: dialect-graph-document.md** — rules from spec § dialect; note engine `expanded` default false; style role map to `Graph*Style` fields (`fill`, `stroke`, etc.).

- [ ] **Step 4: host.md** — contract symbols, gestures, output checklist (`diagram.graph.json` + `diagram.html`).

- [ ] **Step 5: semantic-patterns.md** — short subset (fan-in, nested scope, drill-down, cross-boundary link).

- [ ] **Step 6: SKILL.md** — name `topo-diagram`; description mentioning architecture/structure diagrams with groups/penetration/subnetwork and SVG fallback; workflow: style gate → pattern → route → author → emit; point to references; say create-edge is Alt+drag.

- [ ] **Step 7: Minimal SVG example** — `quadrant.example.html` using style-guide CSS variables (one quadrant chart) to prove svg track exists.

---

### Task 4: Happy-dom contract smoke test

**Files:**
- Create: `.agents/skills/topo-diagram/scripts/smoke-host.mjs`
- Modify: `package.json` (optional `smoke:topo-diagram-skill`)

**Interfaces:**
- Consumes: built IIFE + sample JSON
- Produces: exit 0/1

- [ ] **Step 1: Write smoke script**

Load IIFE into happy-dom window (or `vm` + minimal stubs if canvas missing). Minimum assertions without full canvas paint if needed:

1. `typeof Aitopo.Network === 'function'`
2. `parseDocument(sample)` succeeds
3. `new Network({ interactions: [new CreateEdgeInteraction()] })` constructs
4. If `mount` requires canvas 2d: skip paint; still call `load(doc)` after mount on a div if happy-dom + canvas polyfill works; otherwise assert `toJSON`-shaped round-trip via `parseDocument` only and document canvas smoke as manual.

Prefer: use existing vitest/happy-dom already in repo — add `tests/topo-diagram-skill-bundle.test.ts` that imports bundle-entry symbols (source) OR reads IIFE text for export names, and validates `sample.graph.json` with `parseDocument` + checks groups/edges/networks shape.

```ts
import { readFileSync } from 'node:fs'
import { parseDocument } from '../src/index.ts'
import { describe, expect, it } from 'vitest'

describe('topo-diagram skill sample', () => {
  it('parses golden graph with group cross-edge and subnetwork', () => {
    const raw = JSON.parse(readFileSync(
      '.agents/skills/topo-diagram/assets/host/sample.graph.json', 'utf8'))
    const doc = parseDocument(raw)
    expect(doc.groups?.some(g => g.expanded === true)).toBe(true)
    expect(doc.networks?.detail).toBeTruthy()
    const cross = doc.edges.find(e => e.id === 'cross')
    expect(cross).toBeTruthy()
  })
  it('IIFE file declares contract', () => {
    const s = readFileSync('.agents/skills/topo-diagram/assets/aitopo.iife.js', 'utf8')
    for (const k of ['Network', 'parseDocument', 'CreateEdgeInteraction', 'layoutGrid', 'layoutFlowColumns']) {
      expect(s).toContain(k)
    }
  })
})
```

- [ ] **Step 2: Run** `pnpm test -- tests/topo-diagram-skill-bundle.test.ts`  
Expected: PASS (bundle file must exist from Task 1).

---

### Task 5: Promote Agent Note + verify-notes

**Files:**
- Move/rewrite: `.agents/notes/proposed/process/2026-10-21-topo-diagram-skill.md` → `implemented/process/` with `Status: implemented`, `## Decision` present tense, fold acceptance into `## Testing` / `## Consequences`

- [ ] **Step 1: Promote note** per notes README (Proposal→Decision, drop Acceptance criteria / Risks into Consequences + Testing).

- [ ] **Step 2: Run** `pnpm run verify-notes` — expect ok.

- [ ] **Step 3: Run** `pnpm test` — expect green (or at least the new test + no regressions in full suite if quick).

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Skill tree + SKILL.md | 3 |
| Vendored IIFE + bundle script | 1 |
| Host light-edit + sample | 2 |
| Style-guide gate | 3 |
| Routing topo/svg/defer | 3 |
| Dialect + expanded:true | 2+3 |
| Contract smoke | 4 |
| SVG subset example | 3 |
| Note promotion | 5 |

## Execution handoff

User requested immediate implementation (`开始实施`) → **Inline Execution** via executing-plans in this session.

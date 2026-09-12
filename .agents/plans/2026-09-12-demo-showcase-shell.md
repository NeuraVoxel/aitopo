# AITopo Demo Showcase Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan location note:** This repository places planning artifacts under `.agents/plans/` (not `docs/superpowers/plans/`) per `AGENTS.md` Agent Note placement rules.

**Goal:** Replace the flat vanilla demo with a React Classic-IDE showcase: left sample catalog, top interaction modes, center `Network`, right property write-back, business samples reserved.

**Architecture:** Vite React app under `demo/` mounts one `Network` via `useNetworkDemo`. Samples are a typed registry of documents/factories. Modes rebuild interaction stacks (Observe / Edit / Create Node / Create Link) and share `PatchHistory` when editing. PropertyPanel maps single selection → form fields → `update*` patches.

**Tech Stack:** React 19 (or latest React 18+ compatible with Vite 6), `react-dom`, existing `@neuravoxel/aitopo` `src/` via Vite alias, Vitest for registry/patch helpers, TypeScript ~5.8.

**Spec:** `.agents/notes/proposed/feature/2026-09-12-demo-showcase-shell.md`

## Global Constraints

- Demo-only change; do not redesign public engine APIs unless a blocking gap appears (Create Node is host-side click + `addNode`).
- Property write-back level A only: label, geometry, type, common styles, simple string `data`; alarms/waypoints/multi-select out of scope.
- Default sample is `hello-world` (two nodes, one edge, explicit coordinates, no layout).
- Business group entries are disabled placeholders (`dsh-event-topo`); no document load.
- Keep `pnpm run demo`; add React deps as `devDependencies` (demo-only consumption is fine).
- Promote the proposed Agent Note to `implemented/` only after the shell ships; update Decision to match what landed.
- Engine unit tests must stay green; do not weaken coverage gates.

---

## File map

| Path | Responsibility |
|------|----------------|
| `demo/vite.config.ts` | React plugin, JSX, existing `@neuravoxel/aitopo` alias |
| `demo/index.html` | Mount `#root` only |
| `demo/main.tsx` | `createRoot` → `<App />` |
| `demo/App.tsx` | Classic IDE chrome layout |
| `demo/styles.css` | Shell layout CSS (no purple/cream AI defaults; neutral slate) |
| `demo/hooks/useNetworkDemo.ts` | Network lifecycle, modes, history, selection, status |
| `demo/components/CanvasHost.tsx` | Div ref + mount/destroy |
| `demo/components/SampleNav.tsx` | Grouped sample list |
| `demo/components/Toolbar.tsx` | Modes + Undo/Redo + Debug |
| `demo/components/PropertyPanel.tsx` | Selection form + apply patches |
| `demo/components/StatusBar.tsx` | Status text |
| `demo/samples/types.ts` | `DemoSample`, `DemoSampleGroup`, mode types |
| `demo/samples/registry.ts` | Ordered catalog export |
| `demo/samples/hello-world.ts` | Minimal 2-node document |
| `demo/samples/elements/*.ts` | Node, Edge, Group, Alarm, SubNetwork |
| `demo/samples/business/placeholders.ts` | Disabled entries |
| `demo/lib/property-patch.ts` | Build `GraphPatch` from form diffs |
| `demo/lib/interactions.ts` | Build `Interaction[]` for each mode |
| `tests/demo-registry.spec.ts` | Registry + hello-world parse |
| `tests/demo-property-patch.spec.ts` | Patch builder behavior |
| Delete | `demo/main.ts` (replaced by `main.tsx`) |

---

## Chunk 1: Scaffold + registry

### Task 1: Vite React scaffold

**Files:**
- Modify: `package.json`
- Modify: `demo/vite.config.ts`
- Modify: `demo/index.html`
- Create: `demo/main.tsx`
- Create: `demo/App.tsx` (minimal shell)
- Create: `demo/styles.css`
- Delete: `demo/main.ts`

**Interfaces:**
- Consumes: existing Vite demo script `pnpm run demo`
- Produces: React root rendering a placeholder “AITopo demo” heading; Vite resolves `.tsx`

- [ ] **Step 1: Add React dependencies**

```bash
cd /Users/macff/Documents/AI/coding-agents/deepseek-harness/vendor/aitopo
pnpm add -D react react-dom @types/react @types/react-dom @vitejs/plugin-react
```

Expected: `package.json` lists these under `devDependencies`.

- [ ] **Step 2: Enable React in Vite and point HTML at `main.tsx`**

`demo/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  server: { port: 5179, open: true },
  resolve: {
    alias: {
      '@neuravoxel/aitopo': path.resolve(root, '../src'),
    },
  },
})
```

`demo/index.html`: replace body with `<div id="root"></div>` and `<script type="module" src="./main.tsx"></script>`; link `./styles.css` from `main.tsx` import.

- [ ] **Step 3: Minimal React entry**

```tsx
// demo/main.tsx
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './styles.css'

const el = document.querySelector('#root')
if (el === null) throw new Error('missing #root')
createRoot(el).render(<App />)
```

```tsx
// demo/App.tsx
export function App() {
  return <div className="app">AITopo demo scaffold</div>
}
```

- [ ] **Step 4: Smoke the demo server**

Run: `pnpm run demo` (start briefly, confirm no Vite resolve errors, stop).

Expected: page shows scaffold text; no import of deleted `main.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml demo/
git commit -m "$(cat <<'EOF'
chore(demo): scaffold Vite React entry for showcase shell

EOF
)"
```

---

### Task 2: Sample types, hello-world, registry tests

**Files:**
- Create: `demo/samples/types.ts`
- Create: `demo/samples/hello-world.ts`
- Create: `demo/samples/registry.ts`
- Create: `demo/samples/business/placeholders.ts` (stubs only)
- Create: `tests/demo-registry.spec.ts`

**Interfaces:**
- Consumes: `GraphDocument` from `../src/protocol/types.ts` (or package export)
- Produces:

```ts
export type DemoSampleGroupId = 'getting-started' | 'elements' | 'business'

export interface DemoSample {
  readonly id: string
  readonly title: string
  readonly group: DemoSampleGroupId
  readonly description: string
  /** When true, nav shows disabled; load is a no-op with status message. */
  readonly reserved?: boolean
  readonly defaultLayout?: 'grid' | 'flow'
  readonly document: GraphDocument
}

export function listSamples(): readonly DemoSample[]
export function getSample(id: string): DemoSample | undefined
export const DEFAULT_SAMPLE_ID = 'hello-world'
```

- [ ] **Step 1: Write failing registry test**

```ts
// tests/demo-registry.spec.ts
import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/index.ts'
import { DEFAULT_SAMPLE_ID, getSample, listSamples } from '../demo/samples/registry.ts'

describe('demo sample registry', () => {
  it('defaults to hello-world with two nodes and one edge', () => {
    const sample = getSample(DEFAULT_SAMPLE_ID)
    expect(sample).toBeDefined()
    const doc = parseDocument(sample!.document)
    expect(doc.nodes).toHaveLength(2)
    expect(doc.edges).toHaveLength(1)
  })

  it('lists getting-started before elements and marks business reserved', () => {
    const ids = listSamples().map(s => s.id)
    expect(ids[0]).toBe('hello-world')
    expect(listSamples().some(s => s.group === 'business' && s.reserved === true)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `pnpm exec vitest run tests/demo-registry.spec.ts`

Expected: FAIL resolving `../demo/samples/registry.ts`

- [ ] **Step 3: Implement hello-world + registry**

`hello-world.ts` document (explicit coords, no layout needed):

```ts
import type { GraphDocument } from '../../src/protocol/types.ts'
import type { DemoSample } from './types.ts'

export const helloWorldDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Hello world', kind: 'custom' },
  nodes: [
    { id: 'a', type: 'agent', label: 'A', x: 80, y: 120, w: 80, h: 48 },
    { id: 'b', type: 'agent', label: 'B', x: 280, y: 120, w: 80, h: 48 },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b', label: 'link' }],
  groups: [],
}

export const helloWorldSample: DemoSample = {
  id: 'hello-world',
  title: 'Hello world',
  group: 'getting-started',
  description: 'Two nodes and one edge.',
  document: helloWorldDocument,
}
```

`business/placeholders.ts`:

```ts
import type { DemoSample } from '../types.ts'
import { helloWorldDocument } from '../hello-world.ts'

export const businessPlaceholders: DemoSample[] = [{
  id: 'dsh-event-topo',
  title: 'dsh-event-topo',
  group: 'business',
  description: 'Reserved: DeepSeek Harness event topology.',
  reserved: true,
  document: helloWorldDocument, // unused while reserved
}]
```

`registry.ts` initially exports only hello-world + placeholders (element samples added in Task 4).

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm exec vitest run tests/demo-registry.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add demo/samples tests/demo-registry.spec.ts
git commit -m "$(cat <<'EOF'
feat(demo): add sample registry and hello-world document

EOF
)"
```

---

## Chunk 2: Network hook + chrome

### Task 3: Interaction builders + useNetworkDemo + CanvasHost

**Files:**
- Create: `demo/lib/interactions.ts`
- Create: `demo/hooks/useNetworkDemo.ts`
- Create: `demo/components/CanvasHost.tsx`
- Modify: `demo/App.tsx` (wire canvas + load default sample)

**Interfaces:**
- Consumes: `Network`, `PatchHistory`, `parseDocument`, `contentBounds`, interaction classes from `../../src/index.ts`; `getSample`, `DEFAULT_SAMPLE_ID`
- Produces:

```ts
export type DemoMode = 'observe' | 'edit' | 'create-node' | 'create-link'

export function buildInteractions(mode: DemoMode): readonly Interaction[]

export interface NetworkDemoApi {
  stageRef: RefObject<HTMLDivElement | null>
  sampleId: string
  mode: DemoMode
  debug: boolean
  status: string
  selectedIds: readonly string[]
  canUndo: boolean
  canRedo: boolean
  setSampleId: (id: string) => void
  setMode: (mode: DemoMode) => void
  setDebug: (value: boolean) => void
  undo: () => void
  redo: () => void
  applyPatch: (patch: GraphPatch) => void
  fitContent: () => void
  /** Latest Network instance for property reads (null before mount). */
  getNetwork: () => Network | null
}
```

Mode → interactions (mirror current `demo/main.ts`):

- `observe`: `[]` extras (Network defaults only)
- `edit`: MoveEdgeBend, ResizeNode, MoveNode, DeleteEdge, CreateEdge(`requireAlt: true`), MarqueeSelect, ExternalDrop
- `create-link`: DeleteEdge, CreateEdge(`requireAlt: false`), MarqueeSelect (no MoveNode)
- `create-node`: ExternalDrop + MarqueeSelect + SelectActivate already default; host click handler adds nodes (Task 5)

History: wrap `network.apply` with `PatchHistory` whenever mode !== `observe`.

Selection: subscribe `network.on`; on selection-related / `documentChanged` events refresh `selectedIds` from `network.getSelectedIds()`.

Sample change / mode change: destroy + remount Network (clear history), load sample document, optional `network.layout`, `fitContent`. Reserved sample: do not remount load; set status `"Reserved: …"`.

- [ ] **Step 1: Implement `buildInteractions` with exhaustive switch**

```ts
switch (mode) {
  case 'observe': return []
  case 'edit': return [ /* as above */ ]
  case 'create-link': return [ /* as above */ ]
  case 'create-node': return [new ExternalDropInteraction(), new MarqueeSelectInteraction()]
  default: {
    const _e: never = mode
    throw new Error(String(_e))
  }
}
```

- [ ] **Step 2: Implement `useNetworkDemo` + `CanvasHost`**

`CanvasHost` only renders `<div className="canvas-host" ref={stageRef} />`.

Hook `useEffect` mounts `new Network({ debugPaintRects: debug, interactions: buildInteractions(mode) })` when `stageRef` ready; cleanup `destroy`.

- [ ] **Step 3: Wire App to load `hello-world` on mount**

Manual check: `pnpm run demo` shows two nodes and one edge after fit.

- [ ] **Step 4: Commit**

```bash
git add demo/
git commit -m "$(cat <<'EOF'
feat(demo): mount Network through useNetworkDemo hook

EOF
)"
```

---

### Task 4: SampleNav + Element samples

**Files:**
- Create: `demo/samples/elements/node.ts`
- Create: `demo/samples/elements/edge.ts`
- Create: `demo/samples/elements/group.ts`
- Create: `demo/samples/elements/alarm.ts`
- Create: `demo/samples/elements/subnetwork.ts`
- Create: `demo/components/SampleNav.tsx`
- Modify: `demo/samples/registry.ts`
- Modify: `tests/demo-registry.spec.ts` (assert five element ids present)

**Interfaces:**
- Consumes: `listSamples`, `DemoSample`
- Produces: `SampleNavProps { samples, activeId, onSelect(id: string) }`

Each element sample is a small hand-authored `GraphDocument` highlighting that feature (e.g. Group with `expanded: true` and `labelPosition: 'insideTopLeft'`; Alarm nodes with `alarms`; SubNetwork with nested `networks` / enterable id matching Teams fixture subset).

- [ ] **Step 1: Extend registry test for element ids**

```ts
it('registers element showcases', () => {
  const ids = new Set(listSamples().map(s => s.id))
  for (const id of ['node', 'edge', 'group', 'alarm', 'subnetwork']) {
    expect(ids.has(id)).toBe(true)
  }
})
```

Run → FAIL until samples exist.

- [ ] **Step 2: Author five element documents + register them**

Keep each document ≤ ~15 elements. Prefer explicit `x/y` so pages work with `defaultLayout` omitted.

- [ ] **Step 3: Implement SampleNav grouped UI**

Groups labels: `Getting started`, `Elements`, `Business (soon)`. Reserved rows: `disabled` + `aria-disabled`, `onClick` still calls `onSelect` so hook can set status.

- [ ] **Step 4: Run registry tests PASS; manual click through samples**

- [ ] **Step 5: Commit**

```bash
git add demo/samples demo/components/SampleNav.tsx tests/demo-registry.spec.ts
git commit -m "$(cat <<'EOF'
feat(demo): add element showcase samples and left nav

EOF
)"
```

---

### Task 5: Toolbar modes, create-node click, Debug, Undo/Redo

**Files:**
- Create: `demo/components/Toolbar.tsx`
- Create: `demo/components/StatusBar.tsx`
- Modify: `demo/hooks/useNetworkDemo.ts` (create-node pointer, undo flags)
- Modify: `demo/App.tsx`

**Interfaces:**
- Consumes: `NetworkDemoApi`
- Produces: toolbar buttons calling `setMode`, `setDebug`, `undo`, `redo`

Create Node: while `mode === 'create-node'`, listen to stage `pointerdown` on empty hit (use `network` hit-test if exposed; otherwise if click target is the canvas and selection is empty after select pass, or convert client→world via camera and `addNode` when no node contains point). Prefer: after pointerup, if `getSelectedIds()` empty and event was on stage, `applyPatch({ ops: [{ op: 'addNode', node: { id, type: 'unit', label: 'node', x, y, w: 80, h: 48 } }] })`.

Coordinate conversion: use existing Network camera APIs already used by interactions (`updateCamera` / viewport state). If only interactions convert today, read `network` viewport helpers from `Viewport` usage in `demo/main.ts` patterns — implement `clientToWorld(clientX, clientY)` via the mounted Network’s public camera API; if missing, add a **minimal** demo-local helper using `network`’s exported viewport state (`Viewport.state`) and stage getBoundingClientRect (document any private access; prefer public `Network` methods — if none, use `InteractionHost` surface already on Network).

Debug: `network.setDebugPaintRects(debug)` on toggle without full remount when possible; if API requires remount, remount preserving document via `toJSON()`.

- [ ] **Step 1: Implement Toolbar + StatusBar UI**

Buttons: Observe, Edit, Create Node, Create Link, Undo, Redo, Debug (toggle label `Debug` / `Debug ✓`).

- [ ] **Step 2: Wire create-node world click → addNode through history**

Manual: Edit mode move works; Create Link drags node→node; Undo reverses addNode.

- [ ] **Step 3: Commit**

```bash
git add demo/
git commit -m "$(cat <<'EOF'
feat(demo): add interaction toolbar with create modes and undo

EOF
)"
```

---

## Chunk 3: Properties + ship

### Task 6: property-patch helper + PropertyPanel

**Files:**
- Create: `demo/lib/property-patch.ts`
- Create: `tests/demo-property-patch.spec.ts`
- Create: `demo/components/PropertyPanel.tsx`
- Modify: `demo/App.tsx`

**Interfaces:**
- Consumes: `GraphNode` | `GraphEdge` | `GraphGroup`, form values
- Produces:

```ts
export type PropTarget =
  | { kind: 'node'; element: GraphNode }
  | { kind: 'edge'; element: GraphEdge }
  | { kind: 'group'; element: GraphGroup }

export function buildPropertyPatch(
  target: PropTarget,
  fields: {
    label?: string
    x?: number
    y?: number
    w?: number
    h?: number
    type?: string
    kind?: string
    expanded?: boolean
    labelPosition?: string
    fill?: string
    stroke?: string
    strokeWidth?: number
    labelColor?: string
    labelFontSize?: number
    dataJson?: string // object of string values; invalid JSON → throw
  },
): GraphPatch
```

Empty-state when `selectedIds.length !== 1`. Resolve element from `network.getNodes()` / `getEdges()` / `getGroups()`.

On blur/Enter: `applyPatch(buildPropertyPatch(...))` then refresh from network.

- [ ] **Step 1: Failing tests for patch builder**

```ts
it('updates node label and geometry', () => {
  const patch = buildPropertyPatch(
    { kind: 'node', element: { id: 'a', type: 'agent', label: 'A', x: 0, y: 0, w: 10, h: 10 } },
    { label: 'Renamed', x: 5 },
  )
  expect(patch.ops).toEqual([{
    op: 'updateNode',
    id: 'a',
    patch: { label: 'Renamed', x: 5 },
  }])
})
```

(Adjust exact `GraphNode` required fields to match types.)

- [ ] **Step 2: Run FAIL → implement `buildPropertyPatch` → PASS**

- [ ] **Step 3: PropertyPanel form fields for node/edge/group**

Read-only `id` row. Skip alarms editing.

- [ ] **Step 4: Manual — rename label, undo restores**

- [ ] **Step 5: Commit**

```bash
git add demo/ tests/demo-property-patch.spec.ts
git commit -m "$(cat <<'EOF'
feat(demo): add property panel with patch write-back

EOF
)"
```

---

### Task 7: Layout CSS, README, promote Agent Note, verify

**Files:**
- Modify: `demo/styles.css` (full Classic IDE grid)
- Modify: `README.md` (demo section: how to run, catalog, modes)
- Move: `.agents/notes/proposed/feature/2026-09-12-demo-showcase-shell.md` → `implemented/feature/…` with Decision/Consequences rewrite
- Optional: remove obsolete primary use of `fixtures/fleet.json` from demo (fixtures may remain for tests)

**Interfaces:** none new

- [ ] **Step 1: CSS layout**

```css
.app { display: grid; grid-template-rows: auto 1fr auto; height: 100%; }
.app-body { display: grid; grid-template-columns: 240px 1fr 280px; min-height: 0; }
.canvas-host { min-height: 0; height: 100%; }
```

Neutral slate toolbar (`#0f172a`), not purple/cream templates.

- [ ] **Step 2: Update README demo bullets to match shell**

- [ ] **Step 3: Promote Agent Note**

Rewrite `## Proposal` → `## Decision` (present tense), fold acceptance into `## Testing`, keep Alternatives, add Consequences. `Status: implemented`.

- [ ] **Step 4: Verify**

```bash
pnpm run verify-notes
pnpm run typecheck
pnpm exec vitest run tests/demo-registry.spec.ts tests/demo-property-patch.spec.ts
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add demo/ README.md .agents/notes/ tests/
git commit -m "$(cat <<'EOF'
docs(demo): finish showcase shell and promote Agent Note

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Classic IDE layout | 3, 7 |
| React shell | 1 |
| Observe/Edit/Create Node/Link/Debug/Undo/Redo | 3, 5 |
| hello-world default | 2, 3 |
| Element samples Node/Edge/Group/Alarm/SubNetwork | 4 |
| Business placeholders | 2, 4 |
| Property write-back level A | 6 |
| Promote note / README | 7 |
| Engine tests green | 7 |

## Self-review notes

- No TBD placeholders remain; Create Node coordinate conversion is explicit with a fallback path.
- Types for `DemoMode` / `DemoSample` are consistent across tasks.
- Subagent executors: read the Spec path above before Task 1.

# Agent Note: Topo-diagram shared runtime (no per-diagram IIFE copies)

Status: implemented

## Problem

Each delivered `*-topo/` folder vendored `aitopo.iife.js` + `host.js` + `export-diagram.js`. Engine or skill host fixes required manually refreshing every consumer copy — O(diagrams) sync after every underlying change.

## Decision

**Shared runtime (option A):**

- Authoritative JS lives only under the installed skill: `topo-diagram/assets/` (IIFE + `host/`).
- Product deliverables are `diagram.graph.json` + `diagram.html` only. HTML `script src` uses a relative href into that shared tree (compute with `scripts/runtime-href.mjs <diagram-dir>`).
- Vaults / repos install or symlink the skill once. Rebundle updates all pages that point at those assets — no per-diagram copy step.
- Skill-internal `assets/host/index.html` may keep sibling paths for smoke tests. Portable zip remains an explicit opt-in, not the default.

## Alternatives considered

**Keep per-diagram vendoring + sync script.** Rejected as default: still O(N) copies and stale risk; sync is optional escape hatch only.

**npm/CDN load.** Rejected for notes/offline vaults; conflicts with current file:// / local-browse assumption.

## Consequences

Moving a diagram folder without rewriting hrefs breaks script loads — re-run `runtime-href.mjs` or re-emit HTML. Opening a diagram outside a tree that contains the skill install fails until the skill is linked.

## Testing

`node .agents/skills/topo-diagram/scripts/runtime-href.mjs <any-diagram-dir>` prints valid relative paths to existing asset files. Spot-open one migrated `diagram.html` after symlink.

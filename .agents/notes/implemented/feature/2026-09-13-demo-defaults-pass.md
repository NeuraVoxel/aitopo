# Agent Note: Demo samples showcase engine defaults only

Status: implemented

## Problem

Demo samples carried bespoke styling accumulated while features were built: explicit `icon` keys (23 fields across agents/dsh/element samples and the generated boot recording), custom edge strokes and widths, and a blue Group band. The demo thereby showed off per-element overrides instead of the engine's out-of-the-box look, and the DSH boot recording had drifted from its generator (the checked-in `observe-boot.ts` emits no icons).

## Decision

All samples now rely on engine defaults:

- Every `icon` field removed → default `node` glyph everywhere (status colors already come from `status`, which stays).
- `elements/edge.ts` styles keep only non-color showcases (`strokeDash`, `arrowFrom`/`arrowTo`); strokes and `lineWidth` dropped.
- `elements/group.ts` band drops `stroke`/`strokeWidth`/`fill` and the redundant `padding: 16` (engine default); `labelPosition` kept.
- `dsh/boot.ts` regenerated-file icons stripped by hand to match its generator; re-running the script reproduces the same shape.
- `tests/demo-registry.spec.ts` assertions flipped from pinning `icon === 'agent' | 'skill'` to pinning `icon === undefined`, so reintroducing sample icons is a deliberate act.

The `agent` and `skill` builtin icons remain registered in the icon vocabulary for embedders; only the demo samples stopped using them. Statuses, labels, tooltips, `data` metadata, waypoints, dashes, arrows, sub-networks, and groups are untouched — those are semantic content, not styling overrides.

## Alternatives considered

**Keep `icon: 'agent'` in the Agents group (their showcase purpose).** Rejected: the request was explicitly "全部更改为默认"; the samples still demonstrate agent semantics through `type`, `label2`, `status`, and `data`. Restoring is one field per node if wanted back.

**Edit the harness generator to stop emitting icons.** Not needed: the checked-in `scripts/observe-boot.ts` already emits none; the icons came from a divergent local run.

## Consequences

The demo renders entirely with default theming: node-black bodies, default slate edges, default `node` glyph. Sample visual customization now lives only in git history; registry tests guard against silent reintroduction.

## Testing

Typecheck (root + demo) clean; full suite 173 passed (the pre-existing `labelPosition` mismatch in `demo-registry.spec.ts` remains the only failure, unrelated).

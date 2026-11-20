# Agent Note: Vendor product-level design references

Status: implemented

## Problem

Render-engine work already points at local `twaver.vector`, but product-facing UX (authoring flows, diagram presentation) had no checked-in reference trees. Agents and humans were left to rediscover external repos ad hoc.

## Decision

Add shallow git submodules under `vendor/`:

| Path | Upstream | Use |
|---|---|---|
| `vendor/archify` | https://github.com/tt-a1i/archify.git | Product / architecture authoring UX |
| `vendor/diagram-design` | https://github.com/cathrynlavery/diagram-design.git | Diagram design / presentation UX |

Authority split (also in [AGENTS.md](../../../AGENTS.md) and [vendor/README.md](../../../vendor/README.md)):

- **Engine** (paint, interactions, chrome, geometry) → twaver clean-room.
- **Product UX** → these two submodules, ideas only.

Neither tree is a workspace package; `src/` and `demo/` must not import them. `.gitmodules` sets `shallow = true` (`archify` is large).

## Alternatives considered

- **Copy trees into the monorepo:** rejected — loses upstream history and update path.
- **Document URLs only:** rejected — agents need an on-disk tree beside the engine.
- **Vendor twaver into `vendor/` too:** rejected — twaver stays on the existing local SDK2D paths; product refs are the gap.

## Consequences

- Fresh clones need `git submodule update --init --depth 1`.
- Product UX proposals may cite `vendor/archify` / `vendor/diagram-design`; engine PRs still justify against twaver clean-room rules.

## Testing

- `git submodule status` lists both paths on `main`.
- `ai-eng verify-notes .agents/notes`.

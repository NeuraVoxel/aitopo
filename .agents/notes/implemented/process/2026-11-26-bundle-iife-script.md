# Agent Note: Full-API IIFE bundle script

Status: implemented

## Problem

Hosts that want a browser `<script>` drop-in of the engine (not the topo-diagram skill slim contract) had no first-class package script. Only `bundle:topo-diagram-skill` existed, and that entry exports a pinned subset for skill pages.

## Decision

Add `pnpm run bundle:iife` → `scripts/bundle-iife.mjs`. Vite lib-mode builds `src/index.ts` as an IIFE to `dist/aitopo.iife.js` (global `Aitopo`), minified, with sourcemap. Header records package version, git sha, and pack time. `dist/` stays gitignored; regenerate locally or in CI. Keep `bundle:topo-diagram-skill` for the skill-owned slim contract under `.agents/skills/topo-diagram/assets/`.

## Alternatives considered

- **Reuse / widen the skill bundle entry:** rejected — skill host contract must stay explicit and small; full API would couple skill pages to every export churn.
- **Commit `dist/aitopo.iife.js`:** rejected — artifact belongs in gitignore; skill assets remain the only vendored IIFE in-tree.

## Consequences

- Script-tag consumers: `Aitopo.Network`, `Aitopo.parseDocument`, … match `src/index.ts`.
- Skill rebuild path unchanged (`pnpm run bundle:topo-diagram-skill`).

## Testing

- Run `pnpm run bundle:iife`; confirm `dist/aitopo.iife.js` exists and header lists `global: Aitopo`.

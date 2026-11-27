# Agent Note: Vendor LeaferUI canvas reference

Status: implemented

## Problem

Canvas / infinite-canvas UI patterns (scene graph, edit tooling, dense paint) had no checked-in peer tree beside twaver and the product UX vendors. Agents rediscovered LeaferJS ad hoc.

## Decision

Add a shallow git submodule at `vendor/leafer-ui` → https://github.com/leaferjs/leafer-ui.git (`shallow = true` in `.gitmodules`). It is a design reference only: ideas for canvas UI / performance, not a workspace package. `src/` and `demo/` must not import it or copy Leafer public API names. Catalogued in [vendor/README.md](../../../vendor/README.md) and [AGENTS.md](../../../AGENTS.md). Complements [vendor product references](2026-11-20-vendor-product-references.md) (product UX) and local twaver (engine paint/interaction authority).

## Alternatives considered

- **npm-link / workspace package:** rejected — would couple the clean-room engine to Leafer APIs.
- **Document URL only:** rejected — agents need an on-disk tree next to the other vendor refs.
- **Widen the product-UX vendor note in place:** rejected — Leafer is a canvas-engine peer, not product authoring UX; a separate process note keeps the authority split clear.

## Consequences

- Fresh clones: `git submodule update --init --depth 1 vendor/leafer-ui`.
- Engine proposals may cite Leafer patterns for canvas ideas; twaver remains the render-engine authority for dirty paint / interactions / chrome.

## Testing

- `git submodule status` lists `vendor/leafer-ui`.
- `pnpm run verify-notes`.

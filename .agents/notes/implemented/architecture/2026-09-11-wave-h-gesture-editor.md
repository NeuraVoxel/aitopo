# Agent Note: Wave H GestureEditor and OverlayChromeRegistry

Status: implemented

## Problem

After Waves E–G, `Network` still owned overlay chrome registration, drag paint filter, gesture-drag flags, and all preview/commit editor mutations inline. `InteractionHost` remained a single fat façade implemented only by `Network`, which made editor behavior hard to test without a Network-shaped object and kept orchestration mixed with mutation policy.

## Decision

Wave H splits editor/chrome concerns out of `Network` **without** changing the public `InteractionHost` method set interactions call:

1. **`OverlayChromeRegistry`** (`src/network/overlay-chrome-registry.ts`) — owns the chrome list; `add` / disposer call a supplied `requestOverlayPaint`; `paintAll(renderer)` runs after scene paint.
2. **`GestureEditor`** (`src/network/gesture-editor.ts`) — owns gesture-drag flag, drag paint filter, preview old∪new dirty-rect writes, and `commitNodeMove` / `commitNodeResize` / `commitEdgeCreate` / `commitEdgeRemove`. Depends on a narrow `GestureEditorDeps` (`scene`, `views`, `dirty`, `scheduleScenePaint`, `apply`, `emit`).
3. **`Network`** — constructs both, delegates `InteractionHost` editor/chrome methods, and keeps mount / rAF / camera / load / apply / hit-test / validate orchestration.
4. **Typed host facets** — `InteractionHost` is documented as the intersection of hit / camera / query / chrome / edit / bus facets in `types.ts` (same runtime surface; fakes unchanged).

Document / Patch / Events unchanged. No twaver names.

### Deferred (not Wave H)

Further splitting hit-test into a HitController; rotate; making `GestureEditor` a public export (stays `@internal` via network module unless needed). Move-link shipped in [Wave I](./2026-09-11-wave-i-move-edge-bend.md).

## Alternatives considered

- **Keep everything on Network:** rejected — Wave E–G already proved chrome/edit paths grow independently of camera/validate.
- **Break InteractionHost into required multiple attach arguments:** rejected — every interaction and test fake would churn; intersection types document facets without API break.
- **Move commits into each Interaction class:** rejected — commit policy (membership sentinel, duplicate edge skip) must stay one place.
- **Clone twaver EditInteraction / DefaultInteraction god classes:** rejected — clean-room; AITopo keeps pluggable attach→disposer interactions.

## Consequences

- Editor mutation and chrome registry can be unit-tested with a deps fake without mounting Network.
- Network validate still reads `gestures.dragPaintFilter` for filtered drag paint.
- Public interaction plugins keep calling the same `InteractionHost` methods on Network.

## Testing

- `tests/gesture-editor.spec.ts` — preview dirty rects + commit move/edge via deps fake.
- `tests/overlay-chrome-registry.spec.ts` — add/dispose/paintAll.
- Existing interaction + paint-channel tests still pass against Network.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

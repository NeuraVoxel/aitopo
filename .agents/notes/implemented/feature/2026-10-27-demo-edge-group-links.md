# Agent Note: Edge demo shows Group fold link behaviors

Status: implemented

## Problem

The elements Edge sample only showed style chrome (ortho, dash, arrows, waypoints). Authors had no single place to see how member, penetrate, and group-endpoint edges behave when a Group expands or collapses.

## Decision

`demo/samples/elements/edge.ts` keeps the style gallery on top and adds one expanded `band` (members A/B) plus Outside: member `a→b`, penetrate `a→out`, group-endpoint `band→out`. Element budget stays ≤15. Description tells hosts to double-click the band. Group sample remains the home for multi-band / Group↔Group edges.

## Alternatives considered

**Put fold-link cases only in the Group sample.** Rejected: Edge is the navigation entry for link kinds; fold remapping is a link behavior, not only a Group chrome story.

**Raise the elements ≤15 budget.** Rejected: the combined gallery fits in 15 without a policy change.

## Consequences

Opening Edge and folding the band shows member hide, penetrate remap, and group-endpoint persist in one view. Style-only edges stay in the upper half of the canvas.

## Testing

`tests/demo-registry.spec.ts` asserts Edge includes `band`, member, penetrate, and group→node edges within the elements size cap.

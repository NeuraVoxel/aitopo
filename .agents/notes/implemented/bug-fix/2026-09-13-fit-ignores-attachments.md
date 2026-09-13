# Agent Note: Fit accounts for attachments and real group bands

Status: implemented

## Problem

After clicking Fit, content could end up outside the container. `contentBounds(scene)` unioned only declared geometry — `nodeBounds` (bare body rects, ignoring labels/label2/alarms/always-tooltips) and `groupBounds` (declared x/y/w/h, which for an expanded auto-fit group has nothing to do with the real band). Once node labels became unlimited by default, long labels hang far outside bodies, so fit computed a too-small rect: the camera centered on the bodies while labels spilled past the padded container edge.

## Decision

- `Network.contentBounds()` — instance method over the validated ViewSet: unions every active node/edge/group view (`view.bounds` unions include scene attachments; group views contribute `bandBounds`). Hover-only tooltips stay excluded so transient hover state never changes the fit rect.
- `Network.fitContent(padding = 24)` — validates, measures, and applies `fitBounds` through `updateCamera` in one call; the demo's Fit button/hook now uses it instead of the scene-only helper.
- Standalone `contentBounds(scene)` stays exported but expanded groups now contribute `computeGroupBandBounds` instead of the declared rect.
- The `MIN_ZOOM` clamp behavior is unchanged: content wider than the viewport at minimum zoom still overflows symmetrically by design (e.g. the DSH boot mount network spans ~18k world px).

## Alternatives considered

**Grow `contentBounds` from attachment bounds recomputed in the network layer.** Would duplicate the ViewSet's cached unions; the views are the single source of truth for painted extents.

**Include hover-only tooltips in the fit rect.** Rejected: hover state is transient; fitting would jump as the pointer moves.

## Consequences

Fit now covers the painted content on every sample, including unlimited-length labels and auto-fit bands. Fit output changes only where the old rect was wrong (long labels, expanded bands); pure body-only scenes fit identically.

## Testing

`tests/network-fit.spec.ts`: label-inclusive bounds exceed the body; expanded auto-fit band overrides the declared group rect; `fitContent` centers content and keeps every edge of the painted rect inside the padded viewport (the long-label case fails against the old body-only bounds); standalone `contentBounds` unions scene geometry.

# Agent Note: Expanded group bands wrap member paint extents, not bare bodies

Status: implemented

## Problem

An expanded auto-fit group band was computed from `nodeBounds` alone — the member body rects. But nodes paint wider than their bodies: labels hang below (`labelPosition` default `bottom`), label2 above, alarm badges straddle the top-right corner, and always-on tooltips sit to the right. Inside a group, those attachments spilled past the band edge: the fill stopped short of the member labels while the group's own label sat outside, selection/hover chrome (drawn from the same band) clipped the attachments it should frame, and the band hit area missed the label region.

## Decision

Band computation consumes member **paint extents** (body ∪ attachments) supplied by the validated ViewSet — the same unions the fit fix made authoritative ([fit ignores attachments](2026-09-13-fit-ignores-attachments.md)).

- `group-state.ts` helpers (`memberUnionBounds`, `computeExpandedBandBounds`, `computeGroupBandBounds`, `expandCollapseCenterPatches`) take an optional `MemberBoundsResolver` (`(node) => Rect`). Omitted, they union bare bodies — the scene-only contract for callers without views.
- `ViewSet.validateDirty` validates nodes first, then passes `n => this.nodeUnionBounds(n)` to every `GroupView.validate`; `ViewSet.nodeUnionBounds(node)` reads the validated `NodeView.unionBounds` with a bare-body fallback for not-yet-synced ids.
- `GestureEditor.toggleGroupExpanded` validates the views, then passes the same resolver to `expandCollapseCenterPatches`, so collapse parks the node at the center of the *painted* band and expand recenters on it.

Hover-only tooltips stay out (NodeView already excludes them from unions); `showNodeIconsDefault` is irrelevant to extents (icons paint centered).

## Alternatives considered

**Recompute attachment bounds inside `group-state` from protocol data.** All attachment geometry is pure (`estimateTextSize` + `placeAttachment`), so it is possible — but it would duplicate the ViewSet's sync/validate logic (which attachments exist, style defaults, truncation) and drift, which is exactly the bug class being fixed. The fit note already established views as the single source of truth for painted extents.

**Always include attachments by default (drop the body-only fallback).** The scene-only helpers are called with just a scene (standalone `contentBounds`, tests); they cannot see views without this threading. Forcing a views dependency into `group-state` would invert the layering; an optional resolver keeps the pure-scene contract while every runtime path that paints, hits, or recenters bands supplies the resolver.

**Have `GroupView` reach members through `ViewSet` directly.** Would couple views to their owner set; the resolver parameter keeps `GroupView.validate` testable with a plain scene.

## Consequences

Expanded bands grow by the members' attachment extents (body-only scenes are unchanged). Paint, band hit-testing, selection/hover chrome, drop-target feedback (`getGroupBandBounds`), fit, and expand/collapse centering all read the same `bandBounds`, so they stay mutually consistent as the band grows. Larger bands can overlap sibling groups more; smallest-area hit resolution still picks the tightest containing band. The standalone scene-only `contentBounds` keeps body-only member extents for groups — same best-effort compromise the fit note recorded for scene-only callers.

## Testing

`tests/group-attachments.spec.ts`: the ViewSet-driven band wraps the member label union plus default padding (strictly past the body-only bottom); scene-only `computeExpandedBandBounds` stays body-only while a resolver widens it to match the painted band; `expandCollapseCenterPatches` with the resolver parks the collapsed body at the painted-band center (shifted below the body-only park when labels hang down). Full suite and both typechecks pass (`demo-registry.spec.ts` has one pre-existing failure on clean HEAD, unrelated).

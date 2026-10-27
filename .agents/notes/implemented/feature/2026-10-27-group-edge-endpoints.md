# Agent Note: Group-level edge endpoints

Status: implemented

## Problem

`GraphEdge.from` / `to` were documented and resolved as node ids only. Edges whose endpoints were Group ids never painted (`EdgeView` looked up `scene.nodes` only), Alt+drag create refused group hits, and `removeGroup` left orphan edges. Authors who wanted an explicit Group↔Group or Group↔Node link had no first-class path; member-penetration (member id + collapse remap) stayed the only way to touch a band.

## Decision

Endpoint ids resolve **node first, then group**. Missing both fails loud at `parseDocument` / `addEdge`. Group paint boxes use `computeGroupBandBounds` (expanded band or collapsed body). Node endpoints keep `collapsedGroupForNode` remap. `addNode` / `addGroup` reject a cross-kind id clash; `removeGroup` cascades deletion of edges whose `from`/`to` equal that group id (invert restores them). Create-edge and bend handles accept node|group; rubber-band and bend routing use node centers / `edgeAnchorsFromRects` on band boxes. `ViewSet.markGroupGeometryDirty` also dirties edges that name the group as an endpoint. No new protocol fields and no `version` bump. Member-penetration edges are not rewritten to group ids.

## Alternatives considered

**Rewrite member-penetration edges to group ids on collapse.** Rejected: changes authored identity and breaks agent-link semantics that keep member ids across expand/collapse.

**Add group-only anchor fields on GraphEdge.** Rejected: band-box routing already matches node side pins; extra fields are unnecessary for this capability.

**Soft-fail missing endpoints (skip paint, keep parse).** Rejected: fail-loud at the protocol boundary matches the rest of GraphDocument validation.

## Consequences

Documents may use Group ids in `from`/`to`. Skill and demos that need band-to-band links can author them directly; collapse still remaps member-id edges separately. Hosts that relied on dangling edge endpoints surviving parse must fix their documents.

## Testing

`tests/parse.spec.ts` and `tests/patch.spec.ts` cover endpoint validation, cross-id guards, and removeGroup cascade. `tests/group-attachments.spec.ts` paints Group↔Group / Group↔Node routes. `tests/create-edge.spec.ts` commits Alt+drag between groups. Group demo includes `band→band2` and `band→outside`.

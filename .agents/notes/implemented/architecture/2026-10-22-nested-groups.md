# Agent Note: Nested GraphGroup (parentId + member child groups)

Status: implemented

## Problem

Skill diagrams need an outer band (e.g. 「应用平台」) that also contains an inner expandable Group (「应用层」 with nine platform nodes). The engine treated `memberIds` as node ids only, deferred nesting, and the skill forbade nested groups — so converting 应用层 into a Group forced deleting the outer 应用平台 band.

## Decision

Support **nested groups** with dual bookkeeping (same pattern as nodes):

- `GraphGroup.parentId?: string` — parent group id.
- Parent `memberIds` may list **node ids and child group ids**.
- Cycle in `parentId` fails at load / `asGroup` resolve (loud).
- Depth is unbounded; authors stay shallow (skill: prefer ≤1 nesting level).

### Visibility and agent links

- A node is visible only when **no ancestor group is collapsed**.
- A group is visible only when **no ancestor is collapsed** (itself still paints when ancestors are expanded).
- `collapsedGroupForNode` walks from the owning group up via `parentId` and returns the **nearest collapsed ancestor** (document `from`/`to` stay on member node ids; remapping is view-time only).

### Geometry

- Expanded auto-fit unions **direct node members** plus each **child group’s band** (`computeGroupBandBounds`, recursive).
- Expand/collapse recenter translates direct nodes and **descendant groups + their nodes**.
- View validate order: deepest groups first is unnecessary when band compute is recursive on the scene; paint/hit skip invisible groups; hit-test prefers deeper groups when overlapping.

### Interaction

- Dragging a group moves all descendant nodes and descendant group origins.
- Double-click toggles only the hit group; inner expanded state is preserved while an outer group is collapsed.

## Alternatives considered

- **SubNetwork instead of nesting:** rejected for 应用平台 — platforms are siblings in one scope, not a drill-down document.
- **Flatten to one group (九大平台 + OTA):** rejected — loses a dedicated 应用层 expand target and conflates OTA with platforms.
- **Synthetic proxy node for the inner card:** rejected — dual identity for selection and edges.
- **Serialize remapped edges to the outer group id:** rejected — keep member-id 穿透.

## Consequences

- Documents that put a group id in `memberIds` without matching `parentId` (or the reverse) are repaired at parse by preferring explicit `parentId` and requiring membership listing for auto-fit listing helpers that read both.
- Skill dialect allows one nesting level for architecture bands; deeper trees are engine-legal but discouraged.
- Supersedes the “nested groups deferred” bullet in [group attachments](./2026-09-12-graph-group-attachments.md).

## Testing

- `tests/nested-groups.spec.ts` — visibility, nearest collapsed remap, outer auto-fit includes child band, cycle rejected.
- Existing `tests/group-attachments.spec.ts` remain green (flat groups).

## Related

- [GraphGroup attachments](./2026-09-12-graph-group-attachments.md)
- [topo-diagram skill](../process/2026-10-21-topo-diagram-skill.md)

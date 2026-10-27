# Agent Note: GraphGroup attachments and expand/collapse aligned with twaver.Group / GraphNode

Status: implemented

## Problem

`GraphGroup` was a fixed document band (`id`, `label`, `memberIds`, optional `x/y/w/h`, thin `style` for stroke/fill/dash). `GroupView` cached a single bounds from document geometry; `drawGroup` painted a rounded rect and hard-coded in-body `fillText` for the title. There was no `label2` / `tooltip` / `alarms`, no Attachment instances, no `alpha` / select / hover / shadow, no dual bounds, and no expand/collapse. Members that moved did not resize the band unless the host patched geometry. Selection did not include group ids; there was no drag-group-moves-members path.

[GraphNode attachments](./2026-09-11-graph-node-attachments.md) and [GraphEdge attachments](./2026-09-12-graph-edge-attachments.md) already established protocol approach A (structured fields + View-owned attachments) and dual bounds. twaver.Group (a Node subclass) additionally supplies `expanded`, child-driven body rect + padding, move-children-with-group, hide children when collapsed, and agent links to the group.

## Decision

Ship scope **A**: Node-class visual isomorphism for `GraphGroup` plus Group-core expand/collapse, auto-fit band, selection, and agent-link remapping — still as an independent document element (not a `GraphNode` subtype).

### Protocol (`version` remains `1`)

Additive `GraphGroup` fields: `label2?`, `tooltip?`, `alarms?`, `expanded?` (**omitted = `false`**), `locked?`, `data?` (business bag only). Keep `label`, `memberIds`, optional `x`/`y`/`w`/`h`.

`GraphGroupStyle` carries stroke/fill/dash, `alpha` (default `1`), `padding?`, `autoFit?` (**omitted = `true`**), `shape?: 'rectangle'`, attachment positions and text nests, `tooltipMode`, `select` / `hover` / `shadow`.

`updateGroup` merges `style` one level. Zod, `asGroup` / `mergeGroup`, and invert round-trip the new fields. Fixtures that need open bands set `"expanded": true`. Hosts open a group with `updateGroup { expanded: true }` or double-click (`SelectActivateInteraction` → `toggleGroupExpanded`). Collapsed paints as a **node body** (opaque fill + `group` IconsAttachment by default, default **50×50** matching twaver `NODE_WIDTH`/`NODE_HEIGHT`); override with `w`/`h` / `icon`; opt-in `style.showIcon: false` hides the collapsed icon (skill card chrome). Expanded paints the member band (+ autoFit). No expand-image this wave.

### View / Attachment

Box attachment validate context is widened: `LabelAttachment` / `Label2Attachment` / `AlarmAttachment` / `TooltipAttachment` accept node or group hosts (`GroupAttachmentValidateCtx`). `drawGroup` no longer paints in-body title text.

`GroupView` exposes `bandBounds` and `unionBounds` / `bounds`. Collapsed bands use document `x/y/w/h`. Expanded with `autoFit !== false` unions member body bounds + padding (`DEFAULT_GROUP_PADDING` = 16). Helpers live in `src/ui/group-state.ts`.

### Collapse visibility and agent links

Members of a collapsed group are not painted or hit (`NodeView.isVisible`). `EdgeView.validate` remaps endpoints to the collapsed group’s band when needed; both ends in the same collapsed group deactivate the edge. Document `from`/`to` never change. ViewSet validates nodes → groups → edges.

### Interaction / selection

Group ids participate in `setSelection` and hit-testing (`kind: 'group'`). Overlay draws select/hover chrome on `bandBounds`. Dragging a selected unlocked group patches group `x`/`y` and translates members (`previewGroupMove` / `commitGroupMove`). Drop-into-band membership editing remains for node drags.

### Paint

`GroupPaintView` carries band/union bounds, alpha, resolved stroke/fill/dash/shadow, attachments / overlayAttachments. `drawGroup` applies `globalAlpha`, paints the body, then scene attachment ops.

## Alternatives considered

- **B — visual isomorphism only (no expanded / autoFit):** rejected — leaves stale fixed bands and no collapse.
- **C — autoFit + expanded only, keep in-body label:** rejected — splits Group from the Node/Edge attachment model.
- **Make GraphGroup a GraphNode subtype in the protocol:** rejected — breaks the existing document vocabulary.
- **Insert a synthetic proxy node when collapsed:** rejected — dual identity for selection and patches.
- **Serialize remapped agent edges into the document:** rejected — remapping stays validate-time only.
- **Default `expanded: true`:** rejected — product wants collapsed-by-default with parameter-driven open.
- **Default `autoFit: false`:** rejected — members would drift outside the band without host patches.
- **Groups not selectable:** rejected — product chose full selection with chrome.
- **Hide members but leave edges on hidden node anchors:** rejected — dangling links.
- **New Group* Attachment subclasses that duplicate box placement:** rejected in favor of widened box validate context.
- **Exotic `group.shape`, `group.deep`, Group icons:** deferred.
- **Nested groups:** shipped in [nested groups](./2026-10-22-nested-groups.md) (`parentId` + child ids in `memberIds`).

## Consequences

- Existing fixtures/demos without `expanded: true` render collapsed until hosts opt in.
- Explicit `w`/`h` are ignored while expanded and `autoFit` is true unless `autoFit: false`.
- Edge validate depends on group expand state; group updates mark members and incident edges dirty.
- Authored `waypoints` stay in the document, but **paint/hit ignore them while either endpoint is collapse-remapped** — the view uses auto orthogonal between the remapped band and the peer (see [collapse ignores waypoints](../bug-fix/2026-10-27-collapse-remap-ignores-waypoints.md)). Bend handles hide for remapped edges.
- Collapsed body is a styled rect only (no Group icon this wave).

## Testing

- `tests/group-attachments.spec.ts` — default collapsed, expand + autoFit, attachments, agent remap, alpha/style merge, `autoFit: false`.
- `tests/view-set.spec.ts` / `tests/hit-views.spec.ts` / `tests/move-node.spec.ts` updated for expand defaults and `getGroup`.
- Fixtures `editor.json` / `fleet.json` set `expanded: true`.
- Package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

## Deferred

Group expand-image; exotic shapes; batch-select-members-on-group-select.

## Interaction

`SelectActivateInteraction` (default + Editor additive pack) double-clicks a group to call `Network.toggleGroupExpanded`. That path preserves a shared center: collapse parks the 50×50 body at the expanded band center; expand translates members so the auto-fit band recenters on the collapsed body. Locked groups are skipped. Single click only selects.

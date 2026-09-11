# AITopo ↔ twaver.vector gap backlog

**Status:** living checklist (2026-09-09)
**Package:** `@neuravoxel/aitopo`
**Design reference (read-only):** `/home/jeff/Documents/AI/coding-agent/SDK2D/twaver/vector/`
**Base design:** [2026-09-07-aitopo-design.md](./2026-09-07-aitopo-design.md)
**Editor requirements:** [2026-09-08-aitopo-editor-requirements.md](./2026-09-08-aitopo-editor-requirements.md)

## Summary

AITopo borrows **ideas** from `twaver.vector`; it is a clean-room TypeScript rewrite. This file maps each `/home/jeff/Documents/AI/coding-agent/SDK2D/twaver/vector/**/*.js` module to an AITopo status so follow-up work stays product-driven, not feature-parity-driven.

Do not import SDK2D, copy identifiers (`DataBox`, `ElementUI`, `DefaultInteraction`, …), or treat this backlog as a commitment to port every module.

## Status legend

| Tag | Meaning |
|---|---|
| `done` | Equivalent capability exists under AITopo names |
| `gap` | In design / README as owed work, not finished |
| `later` | Reasonable later; not blocking current milestones |
| `wont` | Explicit non-goal for the current product scope |

## Network / zoom / overview

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `Network.js` | Dual canvas, invalidate/validate, interaction stack, movable gate | `done` (subset) | `Network` + dirty loop + interactions; no `LayerBox` / `setEdit*` names |
| `PhysicalZoomManager.js` | Physical zoom | `done` | `Viewport` |
| `BaseZoomManager.js` | Zoom manager base | `wont` | Folded into `Viewport` |
| `LogicalZoomManager.js` | Logical zoom (font/stroke independent of camera) | `later` | Partial: world-space labels + screen-constant strokes |
| `MixedZoomManager.js` | Mixed zoom policy | `wont` | No product need |
| `Overview.js` | Overview widget | `wont` | Design / README non-goal |
| `OverviewInteraction.js` | Overview pointer wiring | `wont` | |
| `OverviewTouchInteraction.js` | Overview touch | `wont` | |
| `OverviewMSTouchInteraction.js` | Overview MS touch | `wont` | |
| `CanvasUtil.js` | Canvas helpers | `done` (internalized) | `geom` + `canvas2d` |
| `vector_default.js` | Default style table | `wont` | Protocol fields + renderer defaults |

## UI / attachments

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `ElementUI.js` | Validate bounds → paint | `done` | `NodeView` / `EdgeView` / `GroupView` + `ViewSet` |
| `NodeUI.js` | Node body paint | `done` | `NodeView` + `Canvas2DRenderer.drawNode` |
| `LinkUI.js` | Link / edge paint | `done` | `EdgeView` + orthogonal polylines in renderer |
| `GroupUI.js` | Group band + outline styles | `done` | `GroupView` + `GraphGroup.style` |
| `Attachment.js` | Attachment base | `wont` | No attachment hierarchy |
| `BasicAttachment.js` | Shared attachment paint | `wont` | |
| `AlarmAttachment.js` | Alarm badge | `done` (display) | Inline badge paint; `alarmChanged` emitted on `setAlarms` |
| `LabelAttachment.js` | Primary label | `done` (simplified) | Drawn inside `drawNode` |
| `Label2Attachment.js` | Secondary label | `later` | |
| `IconsAttachment.js` | Icon strip | `later` | Host/`data` extension if needed |
| `LinkHandlerAttachment.js` | On-link click handle | `later` | Delete path covered by `DeleteEdgeInteraction` |
| `EditAttachment.js` | Resize/rotate handles | `done` (resize) | Overlay handles via `ResizeNodeInteraction`; rotate still `later` |
| `HTMLNodeUI.js` | HTML overlay node | `wont` | |
| `HTMLLinkUI.js` | HTML overlay link | `wont` | |
| `HTMLLabelAttachment.js` | HTML label | `wont` | |
| `HTMLLabel2Attachment.js` | HTML secondary label | `wont` | |
| `HTMLAlarmAttachment.js` | HTML alarm | `wont` | |
| `ShapeNodeUI.js` | Shape / polyline node | `later` | |
| `ShapeLinkUI.js` | Shape link | `later` | |
| `RotatableNodeUI.js` | Rotatable node | `later` | |
| `GridUI.js` | Grid element UI | `wont` | |

## Interactions

| Reference path | Idea | Status | AITopo / notes |
|---|---|---|---|
| `interaction/BaseInteraction.js` | Attach / tearDown, overlay paint, point conversion | `done` | `Interaction.attach → disposer` + `InteractionHost` |
| `interaction/DefaultInteraction.js` | Live move of selected movable set | `done` | `MoveNodeInteraction` |
| same | Lazy move ghost outline | `done` | `MoveNodeInteraction({ lazyMove: true })` + `drawLazyMoveGhost` |
| same | Rect select overlay | `done` | `MarqueeSelectInteraction` via overlay chrome (replace-only on up) |
| same | Empty-space pan | `done` | `PanZoomInteraction` |
| same | Reparent while **P** held | `done` (behavior change) | Drop hit-test group on pointer-up; drop-target highlight during drag; no chord key |
| `interaction/CreateLinkInteraction.js` | From/to rubber-band | `done` | `CreateEdgeInteraction` |
| `interaction/CreateElementInteraction.js` | Click-to-create element | `later` | Host adds via `externalDrop` + `addNode` |
| `interaction/CreateShapeNodeInteraction.js` | Draw shape node | `wont` unless product asks | |
| `interaction/CreateShapeLinkInteraction.js` | Draw shape link | `wont` unless product asks | |
| `interaction/EditInteraction.js` | Resize / rotate / link points | `done` (resize) | `ResizeNodeInteraction` corners; rotate / link points still `later` |
| `interaction/MoveLinkInteraction.js` | Drag link control points | `later` | Needs edge bend protocol |
| `interaction/MagnifyInteraction.js` | Magnifier | `wont` | |
| `interaction/TouchInteraction.js` | Touch gestures | `later` | Desktop-first |
| `interaction/MSTouchInteraction.js` | MS pointer touch | `later` | |

## Related engine gaps (not a single vector file)

| Item | Status | Notes |
|---|---|---|
| Emit `alarmChanged` on `setAlarms` / alarm-bearing patches | `done` | Emitted for `setAlarms` ops after `apply` |
| Marquee Shift-append selection | `done` | Ctrl/Meta at marquee pointer-up unions with selection |
| Multi-level SubNetwork stack UI | `later` | Root ↔ one child only |
| Alarm propagation tree | `wont` (current phases) | Display + model only |
| WebGL `Renderer` | `later` | Interface reserved; `createRenderer` injects backends |
| React / `agent-observe` adapter | `done` (plugin) | Fleet/flow via `AITopoHost`; SVG stage retired |
| Orchestrator F1 host wiring | `done` (chrome) | Wave D: locked + editor interactions + session layout; CommitSink later |
| Extract View classes from renderer | `done` | `ViewSet` + `src/ui/*-view.ts` |

## Suggested next waves

### P0 — product hosts

- [x] `plugins/agent-observe`: snapshot/flow → `GraphDocument` + mount `Network`
- [x] `plugins/agent-orchestrator` F1 chrome (Wave D): map `locked`, attach editor interactions, layout apply + optional `PatchHistory`
- [ ] `plugins/agent-orchestrator` F1 commit: CommitSink / preset draft write-back (after Wave D)

### P1 — engine debt

- [x] Emit `alarmChanged` on alarm mutations
- [x] Marquee Shift-append if shell needs multi-select add
- [x] Temporary highlight for drop-target group during move (DefaultInteraction `parentRect` idea)
- [x] Overlay-only paint channel (`requestOverlayPaint` / `beginFrame(..., 'overlay')`) — [Wave E](./2026-09-11-aitopo-wave-e-paint-channels.md)
- [ ] Apply op→id scene dirty (Wave F; after E)
- [ ] Preview move/resize dirty-rect instead of `markAll` (Wave F)

### P2 — deeper edit

- [x] Lazy move ghost on overlay
- [x] Resize edit handles (rotate still open)
- [ ] Move-link / link-handler equivalents
- [ ] Rotate handles (needs protocol field)

### Architecture waves

| Wave | Focus | Status |
|---|---|---|
| E | Scene vs overlay paint channels | `done` — [note](../.agents/notes/implemented/architecture/2026-09-11-wave-e-paint-channels.md) |
| F | Apply / preview dirty granularity | later |
| G | View label/alarm/hit facets | later |
| H | Split InteractionHost / gesture controller | later |

### Explicit non-goals

Overview, HTML node/link UI, Magnify, MixedZoom, GridUI, PropertyBox, GIS, DXF, copying or wrapping `/home/jeff/Documents/AI/coding-agent/SDK2D`.

## Maintenance

When a row changes status, update this file in the same PR as the code or host wiring. Keep `vendor/README.md` local-modification log only when `vendor/aitopo/src/**` changes.

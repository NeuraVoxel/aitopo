# Agent Note: Wave E scene vs overlay paint channels

Status: implemented

## Problem

Wave A–B shipped Views, injectable `Renderer`, and an `OverlayChrome` registry, but almost every interaction path still scheduled a full root redraw. `InteractionHost.requestPaint()`, `addOverlayChrome`, `setSelection`, and (via empty dirty → `'all'`) `setHover` called `DirtyAccumulator.markAll()` or left the accumulator empty so `Network.validate` collapsed to `dirtyRects: 'all'`. Live `previewNodePosition` / `previewNodeBounds` also force `markAll` even when only one node moves.

The dual-canvas layout already paints selection rings, marquee, ghosts, and drop-target chrome on the overlay canvas. Without a separate overlay schedule, chrome-heavy editor gestures paid full scene cost and blocked the dirty-rect story in [design](../../../../docs/2026-09-07-aitopo-design.md).

## Decision

Wave E ships **scene vs overlay paint channels** without changing Document / Patch / Events:

1. **Dual schedule flags** — `needsScenePaint` / `needsOverlayPaint` drained by one rAF loop. Scene paint always implies overlay refresh. Overlay-only frames call `beginFrame(cam, 'overlay')` and never clear or redraw the root canvas. Empty scene dirty no longer coerces to `'all'` when only overlay paint is pending.
2. **Host API** — `requestOverlayPaint()` sets overlay only. `requestPaint()` aliases it for chrome-era call sites. `addOverlayChrome`, marquee / create-edge / move chrome updates, `setSelection`, and `setHover` use overlay scheduling. Camera, resize, load, nav, paint-error fallback, drag paint filter, and live preview still `markAll` + scene schedule.
3. **Renderer** — `FrameDirty` includes `'overlay'`. `Canvas2DRenderer.beginFrame` skips root clear/clip/save for that mode; `endFrame` restores root only when a root frame was opened. `drawHoverOverlay` paints a dashed hover ring.
4. **Select / hover visual** — Root `drawNode` stroke ignores `view.selected` / `view.hovered` (status/data/active only). `paintOverlayPass` draws selection rings, hover rings, and highlighted edges after scene bodies (or alone on overlay-only frames).

### Deferred (not Wave E)

Apply op→id dirty and preview dirty-rect narrowing (Wave F); View label/alarm/hit facets (Wave G); InteractionHost split (Wave H); Logical zoom, pixel hit-test, Attachment tree, rotate / move-link.

## Alternatives considered

- **Keep single `requestPaint` → `markAll`:** rejected — chrome registry already existed; the missing piece was the schedule.
- **Overlay always paints every rAF while any chrome is registered:** rejected — idle CPU; selection/hover still need an explicit bit.
- **Partial root dirty for selection/hover (keep blue body stroke):** rejected as primary — still touches root and duplicates the selection ring cue.
- **New `beginOverlayFrame` / `endOverlayFrame` methods:** rejected — one `'overlay'` discriminant on `beginFrame` is enough.
- **Clone twaver `repaintTopCanvas` / marker names:** rejected — clean-room; AITopo keeps `requestOverlayPaint` / `'overlay'` naming.

## Consequences

- Chrome, selection, and hover no longer rebake the root canvas when the scene is otherwise clean.
- Selected/hovered nodes no longer change root body stroke color; rings on the overlay are the primary cue (product-visible in demo/hosts).
- Out-of-tree `Renderer` implementers must accept `FrameDirty = … | 'overlay'` and provide `drawHoverOverlay`.
- Live move/resize preview and `apply` still full-frame or broadly dirty until Wave F.

## Testing

- `tests/paint-channels.spec.ts` (happy-dom) — selection/hover/chrome → `beginFrame(..., 'overlay')` with zero scene body draws; camera → `'all'`.
- Existing interaction fakes updated for `requestOverlayPaint` + `drawHoverOverlay`.
- Full package: `pnpm test`, `pnpm run typecheck`, `pnpm run verify-notes`.

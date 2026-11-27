# Agent Note: AITopo performance roadmap (Waves J–N)

Status: proposed

## Problem

Architecture waves E–I split paint channels, narrowed apply/preview dirty ids, and finished Move-link editing. Relative to a mature `twaver.vector`-style engine, AITopo still pays full-graph cost on several hot paths: continuous idle `requestAnimationFrame`, hover overlay paint with no equality guard, root paints that clip but still `draw*` every element, camera pan/zoom always `markAll`, drag paint filter forcing `'all'`, and O(n) hit-tests. Hosts that need editor drag, observation patch streams, and smooth navigation lack a sequenced performance plan with measurable gates.

## Proposal

Adopt a **Canvas2D-first** performance roadmap that covers editor, observation, and navigation (scope D), sequenced by ROI. Do **not** start WebGL until J–M leave a measured gap. Depends on Waves E–F and Views (A/G). Protocol Document / Patch / Events unchanged unless a later wave proves a field is required (none here).

Roadmap-wide non-goals: Attachment tree; MixedZoom; Overview/tile cache; copying SDK2D; implementing any wave in the same change that only lands this note.

| Wave | Focus | Primary load |
|---|---|---|
| **J** | Demand-driven rAF; hover equality / move coalesce; `debugPaintStats` harness hooks | A+B+C |
| **K** | Viewport/dirty draw culling; optional multi-rect dirty; filter/`lazyMove` defaults so hide-others does not imply full-frame | A+B |
| **L** | Pan/zoom quality ladder (reduced detail or blit while gesturing; full quality on up) | C |
| **M** | Spatial index for hit (and coarse cull); index lifetime tied to View geometry dirty | B + large A |
| **N** | WebGL/hybrid backend only after published node/edge thresholds fail under J–M | B ceiling |

Gap backlog lists Performance waves as `proposed`. Placement follows ai-eng design-spec rules: this note owns the roadmap; no standing checklist twin under `docs/`.

### Baseline vs twaver.vector (performance lens)

| Hot path | AITopo today | Typical vector-class target | Gap |
|---|---|---|---|
| Selection / hover / handles | Overlay-only (E) | Dual canvas / chrome layer | Closed |
| Element apply / live preview | Dirty-rect clip (F); baked View paint bounds ([note](../../implemented/architecture/2026-11-27-view-paint-bounds-dirty.md)); absorb cap ([absorb cap](../../implemented/architecture/2026-11-27-partial-dirty-flood-cap.md)); preview expands ([skip withdrawn](../../implemented/bug-fix/2026-11-27-preview-skip-expand-withdrawn.md)); filter → `'all'` | Local invalidate; optional lazy; multi-rect; lift-to-overlay | Medium (filter / multi-rect / lift remain) |
| Draw loop | Clip + viewport/dirty cull (E); absorb cap on expand | Cull by dirty/viewport; multi-rect | Medium |
| Pan / zoom | Every camera change `markAll` | Full frame or reduced-quality gesture | Large |
| Hit-test | Brute-force nodes + edges | Spatial index | Large |
| rAF | Always scheduled while mounted | Schedule only when dirty | Medium |
| Backend | Canvas2D | Optional WebGL at scale | Deferred (N) |

### Wave detail (when scheduled)

**J — Schedule and input:** demand-driven rAF; `setHover` no-op when unchanged; optional coalesce pointermove hit/hover once per frame; `debugPaintStats`; synthetic harness stub. Non-goals: culling, pan ladder, spatial index. Verify: idle CPU, hover same target, stats when debug on.

**K — Draw less:** optional multi-rect dirty (cap N → `'all'`); revisit filter→`markAll`; host guidance for size-gated `lazyMove`; optional lift-to-overlay drag. Absorb→`'all'` shipped in [absorb cap](../../implemented/architecture/2026-11-27-partial-dirty-flood-cap.md); preview skip-expand withdrawn ([note](../../implemented/bug-fix/2026-11-27-preview-skip-expand-withdrawn.md)). Viewport/dirty cull already in E. Non-goals: pan blit, WebGL. Verify: element visits on single-node drag ≪ N.

**L — Navigation quality ladder:** reduced detail and/or blit during pan/zoom; full quality on settle. Non-goals: tile pyramid, Overview. Verify: scripted pan vs J baseline.

**M — Spatial hit index:** grid (preferred) over node AABB; edge bbox then polyline; update on View geometry dirty; golden brute-force parity. Non-goals: pixel hit first. Verify: hit parity; hover cost vs N.

**N — Backend threshold:** after J–M, if observation graphs miss frame budget past TBD node/edge counts on target hardware → WebGL/hybrid root, Canvas2D overlay. Do not implement in the proposal change.

Backlog order: J → K → L or M by telemetry → N only if gates fire.

### Measurement before tuning

Ship (in Wave J) counters for scene vs overlay frames, dirty mode (`'all'` / rect / overlay), and draw-call or element-visit counts under a synthetic document. Acceptance numbers for later waves are set from that baseline, not from unaudited fps anecdotes.

## Alternatives considered

- **WebGL-first:** rejected for the near term — interface is reserved, but Chrome/edit overlay and protocol stay 2D; without J–M the GPU path would still overdraw and over-hit.
- **Only optimize editor drag:** rejected — scope D requires observation and pan/zoom; J’s schedule fixes help all three with little risk.
- **Tile cache / Overview as Wave L:** rejected — high cost, not required for current product surfaces; pan quality ladder is enough.
- **Pixel hit-test before spatial index:** rejected — odd shapes benefit later; AABB/grid covers topology graphs first.
- **Standing `docs/` checklist twin for wave detail:** rejected after ai-eng design-spec placement — agent plans stay in this note.

## Acceptance criteria

- This note is linked from README and the gap backlog Performance waves table (no separate `docs/` checklist).
- Each wave above states goal, non-goals, and a measurable gate (stats or synthetic gesture).
- No source behavior changes until a wave is explicitly scheduled for implementation.
- Protocol Document / Patch / Events remain unchanged unless a future wave proves a protocol field is required (none proposed here).

## Risks

- Multi-rect dirty and culling can leave stale pixels if old∪new or clip math regresses — Wave K must keep Wave F’s vacate-rect rules and paint-error → `'all'` fallback.
- Defaulting `lazyMove` changes editor feel — must be host-opt-in or gated by graph size, not a silent global flip without product sign-off.
- Spatial index bugs cause missed hits — M needs golden hit tests against brute force on the same fixtures.

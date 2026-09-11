# AITopo performance roadmap (Waves J–N)

> **Owning decision:** [.agents/notes/proposed/architecture/2026-09-11-performance-roadmap.md](../.agents/notes/proposed/architecture/2026-09-11-performance-roadmap.md). This file is the **execution checklist and wave detail** only. **No implementation in the proposal change.**

> **For agentic workers:** Clean-room rules unchanged. Prefer measurable Canvas2D hot-path wins before WebGL. Do not start a wave until product schedules it.

**Scope:** D — editor drag, observation patch/alarm, and pan/zoom, sequenced by ROI.

**Depends on:** Waves E–F (overlay channel + dirty ids); Views (A/G) for cached geometry.

**Out of scope (roadmap-wide):** Attachment tree; MixedZoom; Overview/tile cache; copying SDK2D; protocol changes; implementing any wave in the same change that only lands this doc.

---

## Baseline vs twaver.vector (performance lens)

| Hot path | AITopo today | Typical vector-class target | Gap |
|---|---|---|---|
| Selection / hover / handles | Overlay-only (E) | Dual canvas / chrome layer | Closed |
| Element apply / live preview | Dirty-rect clip (F); filter → `'all'` | Local invalidate; optional lazy | Medium |
| Draw loop | Clip yes; still visits all elements | Cull by dirty/viewport | Large |
| Pan / zoom | Every camera change `markAll` | Full frame or reduced-quality gesture | Large |
| Hit-test | Brute-force nodes + edges | Spatial index | Large |
| rAF | Always scheduled while mounted | Schedule only when dirty | Medium |
| Backend | Canvas2D | Optional WebGL at scale | Deferred (N) |

---

## Wave J — Schedule and input

**Goal:** Stop idle CPU and redundant overlay paints; add paint stats for later gates.

### Tasks (when scheduled)

- [ ] Demand-driven rAF: schedule only when `needsScenePaint || needsOverlayPaint`; reschedule from schedule helpers
- [ ] `setHover`: no-op when id unchanged (no overlay request)
- [ ] Optional: coalesce pointermove hit + hover to at most once per frame
- [ ] `debugPaintStats` (or equivalent): scene/overlay frame counts, dirty mode, element visits / draw calls
- [ ] Synthetic harness stub (document size + scripted gesture) documented for local runs

### Non-goals

Draw culling; camera quality ladder; spatial index.

### Verify

```sh
pnpm test
pnpm run typecheck
# Manual: demo idle CPU; hover same target; stats visible when debug on
```

---

## Wave K — Draw less

**Goal:** Skip off-clip / off-viewport draws; reduce filter-induced full frames.

### Tasks (when scheduled)

- [ ] Cull `drawGroup` / `drawEdge` / `drawNode` against dirty clip and/or viewport AABB
- [ ] Optional: `DirtyAccumulator` multi-rect with max N; overflow → `'all'`
- [ ] Revisit `setDragPaintFilter` → always `markAll`; prefer partial clear or document size-gated `lazyMove`
- [ ] Host guidance: large graphs default `lazyMove: true` (opt-in API, not silent global)

### Non-goals

Pan/zoom blit; WebGL.

### Verify

Stats: element visits on single-node drag ≪ graph size; Hide-others path does not force unexplained `'all'` without a written reason.

---

## Wave L — Navigation quality ladder

**Goal:** Keep pan/zoom interactive on mid-size graphs without permanent low quality.

### Tasks (when scheduled)

- [ ] During pan/zoom: reduced detail (skip labels/alarms/dashes) and/or bitmap blit of last full frame
- [ ] Pointer-up / zoom settle: full-quality `'all'` root paint
- [ ] Keep overlay chrome correct during gesture (selection rings may lag one frame if documented)

### Non-goals

Tile pyramid; Overview widget.

### Verify

Scripted pan on synthetic N-node graph; frame time / dropped frames vs Wave J baseline.

---

## Wave M — Spatial hit index

**Goal:** Hit-test and coarse cull scale better than O(n) on large observation graphs.

### Tasks (when scheduled)

- [ ] Grid (preferred) or quadtree over node AABB; edge coarse bbox then polyline
- [ ] Rebuild/update on View geometry dirty only
- [ ] Brute-force vs index golden tests on fixtures
- [ ] Wire `hitTestScreen` / `hitTestGroupScreen` through index

### Non-goals

Pixel-perfect offscreen hit (optional later); changing selection semantics.

### Verify

Hit parity tests; move-hover cost vs N on synthetic graph.

---

## Wave N — Backend threshold (proposal only until triggered)

**Goal:** Document when Canvas2D is insufficient after J–M.

### Gates (fill numbers after J baseline)

- Observation graph exceeds **TBD** nodes or **TBD** edges under target hardware with J–M enabled, **and** scene paint still misses frame budget.
- Then: WebGL (or hybrid) root scene; Canvas2D overlay remains for chrome.

### Non-goals

Implementing WebGL in the performance-proposal change set.

---

## Suggested backlog order

1. Wave J (schedule + stats)  
2. Wave K (cull + filter/lazy)  
3. Wave L or M depending on whether navigation or large-graph hover hurts more in production telemetry  
4. Wave N only if gates fire  

---

## Related

- Design dirty-rect contract: [design](./2026-09-07-aitopo-design.md)
- Gap backlog: [twaver.vector gap](./2026-09-09-aitopo-twaver-vector-gap.md)
- Prior paint waves: [E](./2026-09-11-aitopo-wave-e-paint-channels.md), [F](./2026-09-11-aitopo-wave-f-dirty-granularity.md)

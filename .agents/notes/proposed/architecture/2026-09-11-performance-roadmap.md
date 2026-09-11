# Agent Note: AITopo performance roadmap (Waves J–N)

Status: proposed

## Problem

Architecture waves E–I split paint channels, narrowed apply/preview dirty ids, and finished Move-link editing. Relative to a mature `twaver.vector`-style engine, AITopo still pays full-graph cost on several hot paths: continuous idle `requestAnimationFrame`, hover overlay paint with no equality guard, root paints that clip but still `draw*` every element, camera pan/zoom always `markAll`, drag paint filter forcing `'all'`, and O(n) hit-tests. Hosts that need editor drag, observation patch streams, and smooth navigation lack a sequenced performance plan with measurable gates.

## Proposal

Adopt a **Canvas2D-first** performance roadmap that covers editor, observation, and navigation (scope D), sequenced by ROI. Do **not** start WebGL until J–M leave a measured gap.

| Wave | Focus | Primary load |
|---|---|---|
| **J** | Demand-driven rAF; hover equality / move coalesce; `debugPaintStats` harness hooks | A+B+C |
| **K** | Viewport/dirty draw culling; optional multi-rect dirty; filter/`lazyMove` defaults so hide-others does not imply full-frame | A+B |
| **L** | Pan/zoom quality ladder (reduced detail or blit while gesturing; full quality on up) | C |
| **M** | Spatial index for hit (and coarse cull); index lifetime tied to View geometry dirty | B + large A |
| **N** | WebGL/hybrid backend only after published node/edge thresholds fail under J–M | B ceiling |

Execution detail and non-goals: [performance roadmap](../../../../docs/2026-09-11-aitopo-performance-roadmap.md). Gap backlog lists Performance waves as `proposed`.

### Measurement before tuning

Ship (in Wave J) counters for scene vs overlay frames, dirty mode (`'all'` / rect / overlay), and draw-call or element-visit counts under a synthetic document. Acceptance numbers for later waves are set from that baseline, not from unaudited fps anecdotes.

## Alternatives considered

- **WebGL-first:** rejected for the near term — interface is reserved, but Chrome/edit overlay and protocol stay 2D; without J–M the GPU path would still overdraw and over-hit.
- **Only optimize editor drag:** rejected — scope D requires observation and pan/zoom; J’s schedule fixes help all three with little risk.
- **Tile cache / Overview as Wave L:** rejected — high cost, not required for current product surfaces; pan quality ladder is enough.
- **Pixel hit-test before spatial index:** rejected — odd shapes benefit later; AABB/grid covers topology graphs first.

## Acceptance criteria

- Roadmap doc and this note are linked from README and the gap backlog Performance waves table.
- Each wave lists: goal, non-goals, file touch set, verify commands, and a measurable gate (stats or synthetic gesture).
- No source behavior changes until a wave is explicitly scheduled for implementation.
- Protocol Document / Patch / Events remain unchanged unless a future wave proves a protocol field is required (none proposed here).

## Risks

- Multi-rect dirty and culling can leave stale pixels if old∪new or clip math regresses — Wave K must keep Wave F’s vacate-rect rules and paint-error → `'all'` fallback.
- Defaulting `lazyMove` changes editor feel — must be host-opt-in or gated by graph size, not a silent global flip without product sign-off.
- Spatial index bugs cause missed hits — M needs golden hit tests against brute force on the same fixtures.

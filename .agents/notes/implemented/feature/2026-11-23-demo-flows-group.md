# Agent Note: Demo flowchart group (WorkFlow)

Status: implemented

## Problem

The demo catalog had element, agent, and DSH showcases, but no nav column for the flowchart / data-flow / swimlane / state / process / loop recipes that product references (`vendor/diagram-design`, `vendor/archify`) and the topo-diagram skill already document. Authors had nowhere in the live demo to compare those layout patterns on the engine.

## Decision

- `DemoSampleGroupId` gains `flows`; `SampleNav` renders it as **WorkFlow** between DeepSeek Harness and Business.
- Nine static samples under `demo/samples/flows/` (shared chrome helpers in `shared.ts`), registered after the DSH rows:
  1. `flow-linear` — single-column top→down process
  2. `flow-decision` — Yes right / No down + merge
  3. `flow-feedback` — U-path + one dashed `dep` return
  4. `flow-swimlane` — two expanded Group lanes + HANDOFF
  5. `flow-fan-in` — three sources → merge → sink
  6. `flow-data` — role×stage sparse pipeline
  7. `flow-state` — labeled state transitions
  8. `flow-process` — three lanes with tool/payload `label2`
  9. `flow-loop` — ring stations + shared hub + dashed write-back spokes
- Documents follow topo-diagram layout-recipe budgets (≤9 nodes / ≤12 edges, orthogonal edges, skill chrome via `data.fill` / `data.stroke`). Samples omit `defaultLayout` so authored `x`/`y` are kept (`network.layout('flow')` would overwrite them). No engine default changes; vendor trees remain ideas-only (no imports).
- `tests/demo-registry.spec.ts` pins group order, the nine ids, parseability, and swimlane / process / loop / feedback invariants.

## Alternatives considered

**Reuse Business placeholders for flowchart rows.** Rejected: Business is reserved for domain showcases; flowchart recipes are a distinct product-facing column and would bury the empty-business signal.

**Import skill `assets/examples/*.json` at runtime.** Rejected: demo samples are TypeScript modules colocated with the registry (same pattern as agents/elements); JSON under the skill is the golden authoring source, not a demo runtime dependency.

**Engine shape primitives (true diamond / oval) before shipping the column.** Deferred: type strings (`decision`, `merge`, `state`) and chrome already communicate recipe roles; shape paint is a separate engine capability if needed later.

## Consequences

Nav order is `started < elements < agents < dsh < flows < business`. Future flowchart demos land under `demo/samples/flows/` with the `flows` group id. Process and Loop are demo-authored adaptations of diagram-design intent, not copies of archify schemas. Skill goldens and demo samples can drift; when they diverge intentionally, update the owning note's Testing facts.

## Testing

`tests/demo-registry.spec.ts` "registers the flows group with nine flowchart samples" and the updated group-order test. Manual: open demo, expand WorkFlow, switch each sample and confirm layout/labels.

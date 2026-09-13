# Agent Note: Agents demo showcase with builtin agent icon

Status: implemented

## Problem

The demo had no way to showcase agent-flavored topologies: nodes carrying agent identity (icon, model, status) and a SubNetwork whose interior is a fleet of agents.

## Decision

- `icon-registry.ts` gains a builtin `agent` icon (robot head: antenna ball, squared face, two eyes) in the same stroke style as the existing four builtins. Any node opts in with `icon: 'agent'`; the unknown-key fallback to `node` is unchanged.
- New element sample `demo/samples/elements/agents.ts` (`id: 'agents'`, registered after `subnetwork`): three `type: 'agent'` nodes (`running`/`active`/`error`, `label2` = model name, `tooltip`, `data: { model, tasks }`, default 50×50 bodies) plus one `type: 'subagent'` node with `networkId: 'agent-fleet'`, joined by `kind: 'data'` edges. The subnetwork document holds six agent nodes in varied statuses with two data edges. Enter/exit reuses the existing double-click navigation; the sample adds no interaction code.
- `tests/demo-registry.spec.ts` adds a dedicated "registers agents showcase with an enterable fleet" case (SubAgent wiring, icon presence, fleet size) plus the `agents` id to the generic element-showcase invariants loop.

## Alternatives considered

**Engine-level node-type registry with custom painting (OOP-style `AgentNode extends Node`).** Rejected: the engine is data-driven (`type` is an opaque string, paint is view-based); a subclass mechanism is a large feature the demo need does not justify. All agent flavor is expressible with existing fields.

**Demo-side factory generating agent documents.** Rejected (YAGNI): the sample is a handful of static nodes; a factory adds an abstraction without removing repetition that matters.

## Consequences

New builtin icon key `agent` is part of the icon vocabulary; samples and embedders can reference it. Registry test now pins fleet size (6) and icon wiring, so structural edits to the sample must update the test deliberately.

## Testing

`tests/demo-registry.spec.ts` new case passes; the generic showcase loop covers `agents` (bounds + ≤15 elements). Typecheck (root + demo) clean. The pre-existing `labelPosition` mismatch failure in the same file (`'top'` vs `'insideTopLeft'`) is unrelated and untouched.

# Agent Note: Agents demo group with builtin agent icon

Status: implemented

## Problem

The demo had no way to showcase agent-flavored topologies: nodes carrying agent identity (icon, model, status), a SubNetwork whose interior is a fleet of agents, or agent-themed workflow pipelines.

## Decision

- `icon-registry.ts` gains two builtins in the same stroke style as the existing four: `agent` (robot head: antenna ball, squared face, two eyes) and `skill` (four-point spark — a capability, not an actor). Any node opts in via `icon`; the unknown-key fallback to `node` is unchanged.
- New sample group `agents` (`DemoSampleGroupId` gains the value; nav renders it between Elements and Business; sample files live under `demo/samples/agents/`), holding three samples in order:
  1. `code-agents` — six mainstream coding agents (Claude Code, Codex CLI, Gemini CLI, OpenCode, GitHub Copilot, Cursor) as AgentNodes with `label2` vendor, `tooltip`, and `data: { vendor, surface }`.
  2. `subagent` — three AgentNodes joined by `kind: 'data'` edges to one `type: 'subagent'` node with `networkId: 'agent-fleet'`; the subnetwork holds six agent nodes in varied statuses. Enter/exit reuses the existing double-click navigation.
  3. `skill-workflow` — two skill pipelines displayed as expanded Groups: `Brainstorming` (eight stages) and `Spec Kit` (seven spec-driven-development stages, with the optional clarify/analyze steps in `cold` status); stages use the `skill` spark icon and `kind: 'flow'` edges chain each group's members in order — a stage is a capability, not an actor.
- No engine behavior changes beyond the icon; samples are pure documents.
- `tests/demo-registry.spec.ts` asserts the group id/order (`elements < adas < agents < …`), the three sample ids in order, per-sample invariants (positioned nodes, ≤15 root elements), the `agent` icon wiring, the SubAgent fleet wiring, and the workflow chain connectivity.

## Alternatives considered

**Engine-level node-type registry with custom painting (OOP-style `AgentNode extends Node`).** Rejected: the engine is data-driven (`type` is an opaque string, paint is view-based); a subclass mechanism is a large feature the demo need does not justify. All agent flavor is expressible with existing fields.

**Demo-side factory generating agent documents.** Rejected (YAGNI): the samples are static documents; a factory adds an abstraction without removing repetition that matters. The workflow sample builds its nodes from a small local stage table, which is the only repetition worth collapsing.

**One combined sample.** Rejected: the group's purpose is separate showcases per concept (who the agents are, how sub-agents nest, how a skill flows); one sample would blur all three and strain the ≤15 root-element invariant.

## Consequences

`agent` and `skill` are part of the builtin icon vocabulary. The registry test pins group order, sample ids/order, fleet size (6), the workflow's two group labels/member counts, and per-group chain connectivity, so structural edits must update the test deliberately. The ≤15 root-element invariant applies to the smaller showcases only; `skill-workflow` carries two pipelines by design. Future agent showcases land in `demo/samples/agents/` under the `agents` group.

## Testing

`tests/demo-registry.spec.ts` "registers the agents group with code agents, subagent, and skill workflow" covers the three samples; the group-order test pins nav sequence. Typecheck (root + demo) clean. The pre-existing `labelPosition` mismatch failure in the same file (`'top'` vs `'insideTopLeft'`) is unrelated and untouched.

# Agent Note: Topo-diagram skill default node chrome is white fill + black title

Status: implemented

## Problem

Skill diagrams often set dark title colors without `data.fill` / `data.stroke`. The engine paints node bodies from `data.fill` (else near-black `#1a1d24`) and light gray icons — black/gray ink on a dark body is unreadable on the skill's light paper host.

## Decision

Skill default node chrome is **white fill + black title**, authored explicitly (engine demo defaults stay dark):

- Every skill node (including SubNetwork members) sets `data.fill: "#ffffff"`, `data.stroke: "#2d3142"`, and `style.label.color: "#000000"`.
- Dialect Label principle, Style roles table, `SKILL.md` non-negotiables, and style-guide `--ink` document the field paths (`data.*` for node body; `style.label` for title).
- Golden host sample (`sample.graph.json` / embedded `index.html`) and SVG example CSS match.

## Alternatives considered

**Change engine `statusFill` default to white.** Rejected: skill global principle keeps aitopo demo defaults stable; light architecture look stays opt-in via authoring params.

**Leave dialect table as bare `fill:` without `data.` path.** Rejected: that ambiguity caused agents to set only `style` / label color and still hit the dark body.

## Consequences

New skill output is readable on light paper without engine changes. Existing diagrams that omit `data.fill` still render with demo-dark bodies until re-authored.

## Testing

Open `.agents/skills/topo-diagram/assets/host/index.html` in a browser: nodes show white bodies and black titles. `ai-eng verify-notes .agents/notes` when notes change.

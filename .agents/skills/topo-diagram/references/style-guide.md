# Style guide

Shared tokens for **topo** (`Graph*Style`) and **svg** (CSS variables) tracks.

## Default tokens

| Role | Token | Value |
|---|---|---|
| Paper | `--paper` | `#f5f5f5` |
| Ink | `--ink` | `#2d3142` |
| Accent / coral | `--accent` | `#bf4520` |
| Muted | `--muted` | `#6b7280` |
| Focal fill | `--focal` | `#bf4520` |
| Default node fill | `--node-fill` | `#ffffff` |
| Default stroke | `--stroke` | `#2d3142` |
| Group band fill | `--group-fill` | `#eef0f3` |

Typography: prefer expressive pairs already chosen for the project; defaults for unbranded work are `"IBM Plex Sans"` / `"Source Sans 3"` with system fallbacks. Do not invent a third display face per diagram.

## First-diagram gate

Before the **first** diagram in a project, if tokens still match the defaults above, pause and ask:

> Style guide is still default. Customize now? (a) website URL (b) paste tokens (c) keep default

After customize or explicit keep-default, skip the gate on later runs. Persist changes into this file (or a project profile in a later skill version).

## Discipline

- **1–2 focal nodes** per diagram use `--accent` / focal styles. More than that erases the signal.
- Prefer deletion: target density ~4/10; above ~9 focal nodes, split or drill down.
- Never invent one-off hex in agent output; map through the role table in `dialect-graph-document.md`.

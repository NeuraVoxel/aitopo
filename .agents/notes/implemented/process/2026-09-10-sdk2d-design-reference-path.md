# Agent Note: SDK2D design reference path

Status: implemented

## Problem

Docs and harness notes pointed agents at `vendor/SDK2D` (optional gitignored copy under deepseek-harness). That tree is not the authoritative reference and invited a dead path.

## Decision

Design reference for `twaver.vector` is the sibling tree at `/home/jeff/Documents/AI/coding-agent/SDK2D` (vector sources under `twaver/vector/`). Prose in this repo and harness `vendor/README.md` uses that path. `vendor/SDK2D` under deepseek-harness is retired (no copy, no gitignore entry).

## Alternatives considered

- **Keep optional `vendor/SDK2D` symlink/copy:** rejected — duplicates the real tree and docs already disagreed about where to look.
- **Relative path from the harness only:** rejected — the peer aitopo repo is not always opened inside `vendor/`; the absolute machine path matches where the reference lives today.

## Consequences

- Agents consult `/home/jeff/Documents/AI/coding-agent/SDK2D/twaver/vector/` for ideas; clean-room rules (no import, no twaver public names) are unchanged.
- deepseek-harness no longer documents or ignores `vendor/SDK2D`.

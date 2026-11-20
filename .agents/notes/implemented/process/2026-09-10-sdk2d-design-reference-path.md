# Agent Note: SDK2D design reference path

Status: implemented

## Problem

Docs and harness notes pointed agents at `vendor/SDK2D` (optional gitignored copy under deepseek-harness). That tree is not the authoritative reference and invited a dead path. The earlier absolute path under `Documents/AI/coding-agent/SDK2D` no longer matches where the trees live on maintainer machines.

## Decision

Design reference for `twaver.vector` is the local `SDK2D/twaver` tree (vector sources under `vector/`). Machine paths:

- Ubuntu: `/home/jeff/Documents/DT/SDK2D/twaver`
- Mac: `/Users/macff/Documents/DT/SDK2D/twaver`

Prose in this repo uses those paths. `vendor/SDK2D` under deepseek-harness is retired (no copy, no gitignore entry).

## Alternatives considered

- **Keep optional `vendor/SDK2D` symlink/copy:** rejected — duplicates the real tree and docs already disagreed about where to look.
- **Relative path from the harness only:** rejected — the peer aitopo repo is not always opened inside `vendor/`; absolute machine paths match where the reference lives today.
- **Single Ubuntu-only absolute path:** rejected — maintainers also work on Mac at `/Users/macff/Documents/DT/SDK2D/twaver`.

## Consequences

- Agents consult `{twaver}/vector/` on the local machine for ideas; clean-room rules (no import, no twaver public names) are unchanged.
- deepseek-harness no longer documents or ignores `vendor/SDK2D`.

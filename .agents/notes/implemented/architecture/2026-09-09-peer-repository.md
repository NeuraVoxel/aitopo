# Agent Note: AITopo peer repository

Status: implemented

## Problem

The engine could not iterate independently while living only as first-party sources under deepseek-harness `vendor/aitopo`.

## Decision

`@neuravoxel/aitopo` develops in this private peer repository (`NeuraVoxel/aitopo`). Agent workflow uses `@neuravoxel/ai-eng`. deepseek-harness consumes this repo via git submodule (then npm). Engine purity (no React, Cordis, or `@deepseek-ai/dsh-*`) remains mandatory.

## Alternatives considered

- Remain first-party under harness `vendor/`: rejected — blocks independent release cadence.
- Depend on harness process gates directly: rejected — peers use ai-eng-kit under K1.

## Consequences

- Design docs under `docs/` stay in this repo.
- Session UI adapters stay in deepseek-harness `plugins/agent-observe`.
- Kit upgrades are explicit dependency bumps, not automatic harness sync.

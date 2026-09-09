# Agent Note: Lock @neuravoxel/ai-eng as a committed devDependency

Status: implemented

## Problem

Requiring contributors to `pnpm add -D ../ai-eng-kit` without committing the change made local setup brittle and diverged from normal package consumption, while CI duplicated a sibling checkout of the kit.

## Decision

Commit `@neuravoxel/ai-eng` as a `devDependency` pinned to a `github:NeuraVoxel/ai-eng-kit#<sha>` (or equivalent git) specifier. CI installs from that lockfile after configuring git auth with `AI_ENG_KIT_TOKEN`; it no longer checks out a sibling kit tree or runs a transient `pnpm add`.

## Alternatives considered

- Keep sibling-only install and document "do not commit": rejected — confusing contributor DX.
- Wait until harness stops submoduling aitopo as a workspace member: rejected — aitopo can lock the kit now; harness impact is documented and temporary.

## Consequences

- `pnpm install` is enough for `pnpm run verify-notes`.
- Kit upgrades are SHA bumps in `package.json` / lockfile.
- Actions still need `AI_ENG_KIT_TOKEN` to read the private kit during install.

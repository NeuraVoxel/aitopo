# Agent Note: ai-eng `init --upgrade` with AGENTS.md marker merge

Status: proposed

## Problem

Consumer repos pin `@neuravoxel/ai-eng` and copy kit scaffolding via `ai-eng init`. On kit upgrades, skills and `docs/testing-policy.md` can be refreshed with `--force`, but `AGENTS.md` cannot: consumers add product sections (for example aitopo’s Design reference) between or after kit standing orders. Today the only options are skip (stale kit text) or `--force` (wipe product text). Manual `diff` / copy is error-prone and undocumented as a single upgrade path.

This note is an **upstream requirements brief for NeuraVoxel/ai-eng-kit** (not an aitopo implementation task). aitopo remains a consumer that will call the new flag once the kit ships it.

## Proposal

Ship `ai-eng init --upgrade` in `@neuravoxel/ai-eng` that refreshes kit-owned scaffold paths and **merges** `AGENTS.md` through a single HTML-comment marker region, preserving consumer-owned text outside that region.

### CLI

| Invocation | Behavior |
|---|---|
| `ai-eng init [path]` | Unchanged: write missing template-owned paths; skip existing |
| `ai-eng init --force [path]` | Unchanged: overwrite template-owned paths, including whole `AGENTS.md` (no merge) |
| `ai-eng init --upgrade [path]` | **New:** overwrite skills, notes README (+ missing lifecycle dirs), and `docs/testing-policy.md`; merge `AGENTS.md` via markers; never touch `README.md` |
| `--force` together with `--upgrade` | Reject; exit 2 |

Default path remains `.`.

Stdout lists refreshed paths in the same style as today’s `init` (for example `AGENTS.md (merged)`, skill paths, `docs/testing-policy.md`).

### Marker syntax (single region)

Emit and recognize exactly one pair, each alone on its line:

```markdown
<!-- ai-eng:begin -->
…full body of templates/AGENTS.root.md…
<!-- ai-eng:end -->

## Consumer section
…
```

Rules:

- Markers are case-sensitive; each must appear exactly once; no nesting.
- Text **between** begin and end is kit-owned and replaced wholesale on `--upgrade` with the current template body (markers rewritten around it).
- Text **before** begin and **after** end is consumer-owned and preserved byte-for-byte (including blank lines).
- Source file `templates/AGENTS.root.md` stays marker-free; `init` / `--upgrade` wrap markers on write.
- First-time `init` (no existing `AGENTS.md`) writes the marked template. The template’s trailing “Product-specific runtime rules…” sentence stays **inside** the kit region; consumer rules go **after** `<!-- ai-eng:end -->`.

### `AGENTS.md` decision tree under `--upgrade`

1. **Missing file** → write marked current template (same as first `init`).
2. **Valid marker pair** → replace the interior with the current template body; keep exterior.
3. **No markers** → run **one-shot auto-wrap** (below); on success, continue as step 2.
4. **Invalid markers** (missing half, duplicates, nesting, not alone on a line) → fail; leave all files unchanged; stderr names the violation.

### Auto-wrap (no markers)

Inputs: `current` = existing `AGENTS.md`; `template` = current kit template body (no markers). Normalize newlines to `\n`; ignore trailing blank lines when comparing.

1. Compute the longest line-wise common prefix of `current` and `template` → `kitPrefix`.
2. Accept only if `kitPrefix` equals a leading prefix of `template` that covers at least through the last standing-order bullet (the lines before the optional “Product-specific…” closing sentence, or the full template).
3. On accept, write:

   - `<!-- ai-eng:begin -->`
   - current **full** `template` body (not the stale prefix text)
   - `<!-- ai-eng:end -->`
   - then `current` with `kitPrefix` removed (consumer suffix)

   So the first successful `--upgrade` both installs markers and lifts the kit region to the new template.

4. On reject: exit 1; do not modify files; stderr shows the first mismatched line (expected vs actual) and a short example of the markers to insert by hand.

### Other template-owned paths under `--upgrade`

| Path | Behavior |
|---|---|
| `.agents/skills/{prose-standard,archive-agent-notes,pre-push-checks}/` | Replace with kit skills |
| `.agents/notes/README.md` | Replace; create missing lifecycle directories; do not touch existing note files |
| `docs/testing-policy.md` | Replace with kit copy |
| `README.md` | Never create or overwrite |
| Other existing `.agents/**` product content | Untouched |

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (including no-op refresh that rewrites identical kit content) |
| 1 | Upgrade logic or I/O failure (invalid markers, auto-wrap reject, write error) |
| 2 | Usage error (for example both `--force` and `--upgrade`) |

### Kit documentation and release

- README documents `init --upgrade`, marker rules, and the consumer upgrade sequence.
- Notes or AGENTS template guidance: product rules belong after `<!-- ai-eng:end -->`.
- ChangeLog entry on the releasing semver; consumers bump the git tag / npm version and run `--upgrade`.

### Consumer upgrade sequence (after kit ships)

```bash
pnpm add -D github:NeuraVoxel/ai-eng-kit#vX.Y.Z
pnpm exec ai-eng init --upgrade .
pnpm run verify-notes
```

### Out of scope (this proposal)

- Multiple or named marker regions
- Three-way merge inside the kit region (manual edits inside the region are discarded on upgrade by design)
- `verify-notes` enforcing AGENTS markers (optional later)
- Auto-bumping the consumer’s `@neuravoxel/ai-eng` dependency

## Alternatives considered

- **Anchor-sentence splice (no HTML comments):** rejected — brittle if the closing “Product-specific…” sentence is edited or translated; markers make ownership explicit and testable.
- **Three-way `merge-file` against a stored prior template:** rejected for MVP — needs a template snapshot channel and conflict UX; contradicts “kit region is authoritative.”
- **`ai-eng merge-agents` separate from `init`:** rejected — consumers want one upgrade command; `--upgrade` already refreshes the other scaffold paths.
- **`init --merge` only for AGENTS:** rejected — leaves skills / testing-policy stale unless a second step; `--upgrade` is the single path.
- **Fail (no auto-wrap) when markers are missing:** rejected — most peers already have “kit prefix + product suffix”; auto-wrap removes a manual migration for the common case, with fail-loud when bullets diverged.
- **Multi-region markers so product text can sit between kit paragraphs:** rejected for MVP — aitopo and the template assume product text after kit standing orders; multi-region complexity is not justified yet.

## Acceptance criteria

- `ai-eng init --upgrade` is documented in kit README/help and covered by unit or smoke tests for: valid markers + suffix preserved; auto-wrap success; auto-wrap fail leaves tree unchanged; invalid markers fail clean; `--force --upgrade` exits 2; missing `AGENTS.md` writes marked template; skills and testing-policy refresh; `README.md` untouched.
- First-time `init` emits marked `AGENTS.md`.
- A consumer with product text after the kit standing orders can upgrade kit standing-order text without rewriting that product text.
- ChangeLog lists the feature under a new package version.

## Risks

- Auto-wrap false negatives when consumers lightly reworded a standing-order bullet — mitigated by clear stderr and a documented hand-marker escape hatch; do not silently guess.
- HTML comments in `AGENTS.md` may surprise readers unfamiliar with the convention — mitigated by README + template guidance and by keeping markers on their own lines.
- `--force` remains a footgun that wipes product `AGENTS.md` — keep it; document `--upgrade` as the normal refresh path.
- This note lives in aitopo until the kit implements the feature; after ship, supersede or archive with a link to the kit ChangeLog / Agent Note rather than treating this file as runtime authority.

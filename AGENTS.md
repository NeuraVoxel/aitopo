<!-- ai-eng:begin -->
# AGENTS.md

Standing orders for AI-assisted work in this repository.

- Non-trivial changes add or update an Agent Note under `.agents/notes/` in the same change ([format](.agents/notes/README.md)).
- Design specs and brainstorming output land in `.agents/notes/proposed/` (Agent Note format); capture raw sparks to `.agents/inbox/` first and promote when ready — not under `docs/superpowers/specs/` and not as standing agent checklists under `docs/` ([placement](.agents/notes/README.md#design-drafts-and-checklists)).
- Registrations and durable decisions state contracts; do not leave reasoning transcripts in comments or docs.
- Prefer explicit resolve/default steps at package boundaries over hidden `??` inside run paths.
- Misconfiguration fails loud at the earliest resolvable point.
- Tests describe behavior, not "correctness."
- Never commit or push automatically after finishing a change; wait for explicit user approval before running `git commit` or `git push`.
- Run the smallest relevant checks before push (`ai-eng verify-notes` when notes change; package tests for code). Add a `verify-notes` script that runs `ai-eng verify-notes .agents/notes` when helpful.

Product-specific runtime rules belong in this file only when this repository owns that runtime.

<!-- ai-eng:end -->
## Design reference

- **Original reference project:** `twaver.vector` (ideas only; clean-room rewrite — no SDK2D imports, no twaver public API names).
- **Authoritative local path:** `/home/jeff/Documents/AI/coding-agent/SDK2D` (vector sources under `twaver/vector/`).
- Do not use or recreate `vendor/SDK2D` under deepseek-harness; that path is retired.

Product-specific runtime rules belong in this file only when this repository owns that runtime.

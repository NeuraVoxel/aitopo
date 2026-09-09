# AGENTS.md

Standing orders for AI-assisted work in this repository.

- Non-trivial changes add or update an Agent Note under `.agents/notes/` in the same change ([format](.agents/notes/README.md)).
- Registrations and durable decisions state contracts; do not leave reasoning transcripts in comments or docs.
- Prefer explicit resolve/default steps at package boundaries over hidden `??` inside run paths.
- Misconfiguration fails loud at the earliest resolvable point.
- Tests describe behavior, not "correctness."
- Run the smallest relevant checks before push (`ai-eng verify-notes` when notes change; package tests for code). Add a `verify-notes` script that runs `ai-eng verify-notes .agents/notes` when helpful.

Product-specific runtime rules belong in this file only when this repository owns that runtime.

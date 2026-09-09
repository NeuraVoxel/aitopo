# Testing policy

Portable testing guidance for repositories initialized with `@neuravoxel/ai-eng`.

## Behavior over correctness

Tests describe behavior, not correctness. Name the observable outcome a change must preserve or reject. When behavior changes deliberately, update the owning tests in the same change and explain why in the PR.

## Coverage gates

Prefer per-`src` coverage gates in CI rather than a single repository-wide percentage that hides uncovered modules. A practical Vitest recipe:

```ts
coverage: {
  include: ['src/**'],
  thresholds: {
    statements: 90,
  },
}
```

Exact thresholds are consumer-chosen. For libraries, start at **statements 90** and raise only when the package's risk justifies it. When selecting local evidence before push, name both the owning tests and the source files those tests must prove.

## Expected output placement

Owner-local expected output lives next to the owning test (for example under `tests/expected/` or beside the fixture). A top-level snapshot tree is only for full product round-trips the consumer defines and owns.

## What this kit does not ship

`@neuravoxel/ai-eng` does **not** ship harness recorded-session replay, session JSONL fixtures, or profile-pinned snapshot harnesses. Consumers that need those mechanisms keep them in their own repository.

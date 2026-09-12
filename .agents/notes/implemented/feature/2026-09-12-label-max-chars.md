# Agent Note: Configurable label truncation (Group labels untruncated by default)

Status: implemented

## Problem

`LabelAttachment` / `Label2Attachment` hard-truncated every label to **18** characters (`MAX_CHARS`). Observe Agent Flow group titles (e.g. `① End-to-end architecture`, `② Real Steps in Turn`) painted as abbreviated ellipsis on the dark canvas. Hosts could not opt out: `GraphTextStyle` only exposed `color` / `fontSize`. Observe must not fork paint; the engine owns truncation.

## Decision

`GraphTextStyle` carries optional `maxChars?: number` (Zod `int` ≥ 0; document `version` stays `1`):

- **Omitted on nodes / edges:** default `18`.
- **Omitted on groups:** default `0` (no truncation; full `GraphGroup.label` / `label2`).
- **`0`:** never truncate (any host).
- **Positive `n`:** truncate to `n` with the existing `…` rule (`truncateText` / `resolveMaxChars` in `label-attachment.ts`).

`LabelAttachment` / `Label2Attachment` and edge label attachments read `style.label.maxChars` / `style.label2.maxChars` with those defaults. Patch / invert round-trip the field via existing one-level style merge.

Observe relies on the group default (or may set `label.maxChars: 0` explicitly in host styles).

## Alternatives considered

- **Observe-only workaround (shorter locale strings):** rejected — product wants full titles, not shorter copy.
- **Raise global `MAX_CHARS` only:** rejected — still clips long EN titles; nodes may still want a short cap.
- **Always unlimited for every label:** rejected — node/edge badges on dense graphs still benefit from a default cap.

## Consequences

- Existing node/edge documents unchanged (still 18).
- Group titles are full-length unless a host sets `maxChars`.
- Very long group titles widen attachment bounds (hit/dirty union); hosts that need clipping set an explicit cap.

## Testing

- `tests/node-attachments.spec.ts` — default node truncate; `maxChars: 0` / `maxChars: 8`.
- `tests/group-attachments.spec.ts` — group default untruncated; `style.label.maxChars: 10` truncates.
- Package: `pnpm test` (attachment suites), `pnpm run typecheck`.

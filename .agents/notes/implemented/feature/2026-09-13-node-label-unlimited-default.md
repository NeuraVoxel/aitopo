# Agent Note: Node labels unlimited by default, maxChars stays configurable

Status: implemented

## Problem

GraphNode labels truncated at 18 characters by default (`DEFAULT_NODE_MAX_CHARS = 18`), clipping legitimate long labels with an ellipsis even when the host never asked for a limit. Groups already defaulted to unlimited; nodes were the odd one out.

## Decision

`DEFAULT_NODE_MAX_CHARS` drops from `18` to `0` (no truncate), making the omitted-`maxChars` behavior uniform for nodes and groups. The opt-in configuration is unchanged and already supported per element: `style.label.maxChars` / `style.label2.maxChars` (`0` = unlimited, positive = ellipsis at N chars). Edge labels keep their 18-char default — the request scoped only GraphNode. `GraphTextStyle.maxChars`'s JSDoc documents the new host defaults.

## Alternatives considered

**Move the default into `Network`/host options (e.g. `labelMaxChars` host-level knob).** Rejected for now: no caller needs a global knob yet; per-element style already covers configuration, and a host option would add a third resolution layer (style → host → constant) without a use case. Revisit if a host asks for a blanket limit.

**Also unlimited edge labels.** Rejected: out of scope; edge labels sit on open paths where run-on text overlaps siblings, and no request asked for it.

## Consequences

Documents that previously displayed ellipsized node labels now render the full text; layouts relying on the 18-char cap for label width may see wider labels (labels are outside the body, so body bounds do not change, but union bounds can grow). Elements needing the old cap set `style.label.maxChars: 18` explicitly.

## Testing

`tests/node-attachments.spec.ts` "does not truncate node labels by default; honors style.label.maxChars" asserts the full label renders by default and an `updateNode` patch to `maxChars: 8` ellipsizes; the emission test now expects the full text. `tests/view-set.spec.ts` cached-ops assertion updated likewise. Typecheck clean.

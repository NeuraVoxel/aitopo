# Agent Note: Topo host Fullscreen menu action

Status: implemented

## Problem

Delivered topo pages had Fit / Expand / Collapse under ⋯ → View but no way to take the diagram page fullscreen from the stock host chrome.

## Decision

`assets/host/host.js` wires `#btn-fullscreen` (`menuitemcheckbox`) to the Page Fullscreen API on `document.documentElement` (top bar + canvas stay together). Enter/exit sync aria-checked / label (`Fullscreen` ↔ `Fullscreen ✓`), keep the menu open like Edit mode, and refit via `fitIfSizeChanged` on `fullscreenchange` / `webkitfullscreenchange`. Unsupported browsers disable the control. Sample `index.html` and `references/host.md` list the control under View.

## Alternatives considered

**Fullscreen only `#canvas`.** Rejected: hides the ⋯ menu and title; exiting would need a floating control the host does not ship.

**CSS-only `position: fixed` faux fullscreen.** Rejected: misses OS chrome hide and Esc conventions the Fullscreen API already provides.

## Consequences

New diagrams from the skill template get Fullscreen automatically. Older `diagram.html` pages need the `#btn-fullscreen` row (and current `host.js`) to expose the action; linking the shared skill `assets/host/host.js` alone is not enough without the button id in markup.

## Testing

Manual: open `assets/host/index.html` → ⋯ → Fullscreen → page fills the display and Network refits; toggle or Esc restores; menu checkmark tracks state. `ai-eng verify-notes` after the Agent Note.

# Agent Note: GraphTextStyle.offsetY

Status: implemented

## Problem

Authors needed a few world pixels of vertical nudge on node labels (ADAS Sensor brand captions sit too tight under the ego) without inventing a new attachment position.

## Decision

`GraphTextStyle` gains optional `offsetY` (+Y = down). `LabelAttachment` / `Label2Attachment` apply it after placement (including stacked subtitles). Omitted ≡ `0`. ADAS Sensor ego brand labels use `offsetY: 8`.

## Alternatives considered

- **New attachment positions / larger default bottom gap:** rejected — global gap moves every bottom label; enum bloat for a pixel nudge.
- **Pad the ego box or fake spacer glyphs:** rejected — breaks BEV scale and follow geometry.

## Consequences

- Schema / parse accept `style.label.offsetY` (and label2).
- Pixel nudges stay document-authored; no host-side layout hacks for Sensor brands.

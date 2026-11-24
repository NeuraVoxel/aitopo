# Agent Note: Edge corner anchors

Status: implemented

## Problem

Authors need to stagger multiple orthogonal leaves from the same box side (e.g. NVIDIA → QCraft on `bottom` and NVIDIA → Applied Intuition offset right) without inventing invalid GraphDocument tokens. The engine only accepted side midpoints (`top`/`bottom`/`left`/`right`) plus `radial` on `fromAnchor`/`toAnchor`. Attachment chrome already had `bottomRight`-style positions, which led authors to reuse those tokens on edges; parse failed loud and blanked host pages. twaver already exposes corner positions on `link.from.position` / `link.to.position` (e.g. `bottomright`).

## Decision

Extend GraphEdge `fromAnchor` / `toAnchor` with four box **corners**: `topLeft`, `topRight`, `bottomLeft`, `bottomRight` (camelCase, matching AttachmentPosition naming — not twaver’s lowercase `bottomright`).

- `anchorPoint` pins the geometric corner of the AABB.
- Corners count as **vertical** leave/arrive for complementary-elbow detection (same family as `top`/`bottom`), so `bottomRight`→`left` stays a two-segment elbow; parallel vertical pairs keep the mid Z / waypoints path.
- Zod / TypeScript enums stay the single fail-loud gate; unknown tokens (including twaver spelling `bottomright`) still reject at parse.
- Default auto-route without anchors is unchanged.

## Alternatives considered

- **Keep sides-only; force waypoints for stagger:** rejected — authors already expected corner pins; waypoints remain last resort per dialect.
- **Import twaver lowercase `bottomright` strings:** rejected — protocol already uses camelCase for attachment positions; dual spellings would fork the dialect.
- **Free `xoffset`/`yoffset` like twaver:** deferred — corners cover the common stagger; continuous offsets can be a follow-up if needed.
- **Treat corners as both V and H for complementary pairs:** rejected — ambiguous; vertical-family rule matches “leave the bottom edge, just not at center.”

## Consequences

- Skill dialect documents corner pins next to side pins; solution diagrams can use `fromAnchor: "bottomRight"` without crashing parse.
- Orthogonal orientation for a lone corner pin prefers the vertical family when choosing H.V vs V.H mid corridors.

## Testing

- `tests/edge-corner-anchor.spec.ts` — corner geometry, parse accept/reject, stagger vs `bottom`, complementary elbow, waypoint polyline axis-alignment.

# Agent Note: Element angle + angleAnchor

Status: implemented

## Problem

aitopo elements cannot rotate. twaver `Node` stores `_angle` (degrees) and paints/hits around the original body center; Group/ShapeNode inherit it. Demo and ADAS cases need rotated boxes, paths, and shape bodies without baking transforms into authored geometry.

## Decision

Add optional rotation to **Node / Group / Path / ShapeNode** (not Edge this wave):

```ts
angle?: number
// degrees; omitted ≡ 0; writers normalize to [0, 360)

angleAnchor?: { u: number; v: number }
// relative to originalBounds; u/v clamped to [0,1]; omitted ≡ { u: 0.5, v: 0.5 }
```

### Geometry (twaver-inspired, clean-room)

- **originalBounds** — unrotated body (`x/y/w/h` or Path/ShapeNode control-point AABB).
- **pivot** — `(x + u·w, y + v·h)` from `angleAnchor` (default center).
- **Paint** — rotate canvas (or densified points) about pivot by `angle`.
- **Hit** — inverse-rotate the world point about pivot, then test in original space.
- **Dirty / cull bounds** — AABB of rotated original corners (or rotated densified polyline).
- Path / ShapeNode **do not rewrite** control points when `angle` changes.

Group rotation affects the **band chrome only**; members keep independent `angle` / `angleAnchor`.

### Interaction

- `RotateElementInteraction` in Edit pack: rotate handle above original top-mid, transformed by current angle about pivot; drag commits `angle` via update patches.
- `ResizeNodeInteraction`: corner handles follow rotated original corners; drag deltas interpreted in original space (inverse-rotate pointer delta about pivot) for Node (and Group collapsed/expanded band resize if already supported — Node first).

### Demo / testing

- Elements samples: non-zero `angle`; at least one non-center `angleAnchor`.
- Specs: parse/defaults, pivot, rotated AABB, hit, rotate commit.

## Alternatives considered

- **Bake Path/ShapeNode points on rotate:** rejected — loses authored geometry; conflicts with vertex edit.
- **Edge editable angle:** rejected this wave — twaver Link angle is endpoint-derived for labels, not a stored body rotation.
- **Named anchors only / local px anchors:** rejected — relative `{u,v}` stays stable across resize.

## Consequences

- Protocol, views, canvas paint, hit, dirty pads, resize, and Edit interactions all grow `angle` awareness.
- Demo `PropertyPanel` exposes `angle` / `angleAnchor` (`anchor u` / `anchor v`) for Node / Group / Path / ShapeNode; `property-patch` writes them through existing update ops. Edge has no editable angle.

## Testing

- `tests/geom-angle.spec.ts` — normalize / pivot / AABB / inverse rotate.
- `tests/angle-views.spec.ts` — rotated view bounds, path hit, screen hits.
- `tests/demo-registry.spec.ts` — Elements samples include angled Path / ShapeNode.
- `tests/demo-property-patch.spec.ts` — angle / angleAnchor write-back for Node / Group / Path / ShapeNode.
- Demo Edit mode: `RotateElementInteraction` handle above selected unlocked Node / Group / Path / ShapeNode.

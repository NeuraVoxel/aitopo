# Agent Note: Node vectorImage registry (binding first slice)

Status: implemented

## Problem

ADAS and Elements demos need parametric body overlays (heading arrows whose length/phase follow node data) without baking geometry into freestanding Path every time. twaver covers this with Node image → registered vector ImageAsset → state/animate/binding local redraw. aitopo only had square `IconsAttachment` badges (`registerIcon`), which cannot bind length or axle-local drawing.

## Decision

Clean-room first slice (no twaver API names):

- `registerVectorImage` / `getVectorImage` — function drawers paint in **unrotated body space** after fill/stroke; the canvas is already rotated about `angleAnchor` when the node is angled.
- `GraphNode.vectorImage?: string` — registry key; unknown keys skip the overlay (unlike `icon`, which falls back).
- `GraphNodeStyle.vectorImageState?: string` — discrete state binding for drawers.
- `data.vectorImagePhase?: number` — `[0,1)` phase binding for host-driven pulse; hosts animate by `updateNode` data patches (declarative animate DSL deferred).
- Distinct from `icon` / IconsAttachment.

Demo: `registerDemoVectorImages()` registers `demo-heading-arrow`; ADAS `Ego` (`adas-ego`) shows `heading` + `heading-boost`; Observe/Edit pulse `heading` phase via silent apply.

## Alternatives considered

- **Extend IconsAttachment only:** rejected — square center badge cannot express axle-local length or speed binding.
- **Full declarative state/animate vector DSL in this wave:** deferred — function drawers + data/state binding unblock demos; DSL is a follow-on.
- **Reuse GraphPath for every heading overlay:** rejected as the only long-term path — fine for ADAS ego sample A, but not for parameterised Node-local chrome.

## Consequences

- Protocol / patch / invert grow `vectorImage` and `vectorImageState`.
- Canvas `drawNode` calls the registry after body stroke.
- Optional `VectorImageDefinition.bounds` feeds `NodeView` union so drag dirty clears ink past the body; drawers that omit `bounds` still risk residuals when painting outside the box.
- Full ImageAsset-like animate graphs remain future work; do not invent twaver `registerImage` names in the public API.

## Testing

- `tests/vector-image.spec.ts` — register/resolve, parse state/phase, updateNode keeps key; NodeView unions `bounds` past body.
- `tests/demo-registry.spec.ts` — Elements `node` document still loads; ADAS ego retains Path heading (sample A).

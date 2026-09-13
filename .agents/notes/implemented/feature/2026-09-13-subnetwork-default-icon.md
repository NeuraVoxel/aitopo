# Agent Note: SubNetwork nodes get a default subnetwork icon

Status: implemented

## Problem

Nodes carrying `networkId` (enterable SubNetworks) rendered with the plain `node` glyph — indistinguishable from ordinary nodes until double-clicked. Node and Group already had distinct default icons in a shared square-and-dot stroke family.

## Decision

- New builtin `subnetwork` icon in the same family: outer square (node geometry), a nested inner square, and a small core dot — the nesting reads as "enterable network".
- `IconsAttachment` resolves a node's icon as: explicit `icon` key wins (unknown keys still fall back to `node`, preserving the documented registry behavior); otherwise `subnetwork` when `networkId` is set, else `node`. No schema change; `GraphNode.icon` JSDoc documents the new default.
- Groups are unaffected (`GraphGroup` has no `networkId`).

## Alternatives considered

**Require samples/embedders to set `icon: 'subnetwork'` explicitly.** Rejected: the enterable affordance is structural (`networkId`), so the default should reflect it without per-document boilerplate; explicit icons still override.

**Mark SubNetworks only via body color.** Rejected: status already owns body color; icon is the free channel and stays consistent with the node/group glyph family.

## Consequences

Every `networkId` node in existing documents (demo SubNetwork/SubAgent showcases included) picks up the glyph automatically with no document edit; an explicit `icon` field suppresses it. The icon vocabulary grows by one key.

## Testing

`tests/node-attachments.spec.ts` "defaults networkId nodes to the subnetwork icon; explicit icon wins" pins all three resolution paths (networkId default, explicit override, plain node). Typecheck clean.

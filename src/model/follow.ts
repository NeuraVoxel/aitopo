/**
 * followHostId cascade — translate followers when a host moves.
 * Edges are excluded; Node / Group / Path / ShapeNode may follow any of those.
 */

import type { GraphPatch, GraphPatchOp } from '../protocol/patch.ts'
import type {
  GraphDocument,
  GraphGroup,
  GraphNode,
  GraphPath,
  GraphShapeNode,
} from '../protocol/types.ts'

/** Element kinds that may carry `followHostId` / act as hosts. */
export type FollowKind = 'node' | 'group' | 'path' | 'shapeNode'

/**
 * Fail loud when any `followHostId` is missing, self, or forms a cycle.
 * @param doc - document after parse or patch apply.
 */
export function assertFollowHostValid(doc: GraphDocument): void {
  const kindById = collectKindById(doc)
  const hostOf = collectHostOf(doc)

  for (const [id, hostId] of hostOf) {
    if (hostId === id) {
      throw new Error(`followHostId: ${id} cannot follow itself`)
    }
    if (!kindById.has(hostId)) {
      throw new Error(`followHostId: ${id} references missing host ${hostId}`)
    }
    let walk: string | undefined = hostId
    const seen = new Set<string>([id])
    while (walk !== undefined) {
      if (seen.has(walk)) {
        throw new Error(`followHostId: cycle involving ${id} via ${walk}`)
      }
      seen.add(walk)
      walk = hostOf.get(walk)
    }
  }
}

/**
 * Expand a patch so host geometry moves also translate followers, and host
 * deletes clear `followHostId` on dependents. Idempotent when re-run on an
 * already-expanded patch (followers already carry explicit geometry ops).
 * @param doc - document before apply.
 * @param patch - incoming ops.
 */
export function expandFollowMotion(doc: GraphDocument, patch: GraphPatch): GraphPatch {
  const hostOf = collectHostOf(doc)
  const followersOf = invertHostMap(hostOf)
  const kindById = collectKindById(doc)
  const explicitGeometry = new Set<string>()
  const removedIds = new Set<string>()

  for (const op of patch.ops) {
    const geoId = geometryTargetId(op)
    if (geoId !== undefined) explicitGeometry.add(geoId)
    const removed = removeTargetId(op)
    if (removed !== undefined) removedIds.add(removed)
  }

  const extra: GraphPatchOp[] = []

  for (const op of patch.ops) {
    const motion = hostMotionDelta(doc, op)
    if (motion === undefined) continue
    if (motion.dx === 0 && motion.dy === 0) continue
    const queue: { id: string; dx: number; dy: number }[] = [
      { id: motion.id, dx: motion.dx, dy: motion.dy },
    ]
    const applied = new Set<string>()
    while (queue.length > 0) {
      const current = queue.shift()!
      const followers = followersOf.get(current.id)
      if (followers === undefined) continue
      for (const followerId of followers) {
        if (explicitGeometry.has(followerId)) continue
        if (applied.has(followerId)) continue
        if (removedIds.has(followerId)) continue
        const kind = kindById.get(followerId)
        if (kind === undefined) continue
        applied.add(followerId)
        const translateOp = translateFollowerOp(doc, followerId, kind, current.dx, current.dy)
        if (translateOp !== undefined) {
          extra.push(translateOp)
          explicitGeometry.add(followerId)
        }
        queue.push({ id: followerId, dx: current.dx, dy: current.dy })
      }
    }
  }

  for (const removedId of removedIds) {
    const followers = followersOf.get(removedId)
    if (followers === undefined) continue
    for (const followerId of followers) {
      if (removedIds.has(followerId)) continue
      const kind = kindById.get(followerId)
      if (kind === undefined) continue
      extra.push(clearFollowOp(followerId, kind))
    }
  }

  if (extra.length === 0) return patch
  return { ops: [...patch.ops, ...extra] }
}

/**
 * Transitive follower ids of `hostId` (direct and cascaded). Does not include
 * the host itself.
 * @param doc - document or scene projection with follow edges.
 * @param hostId - host element id.
 */
export function listTransitiveFollowers(
  doc: {
    readonly nodes: ReadonlyMap<string, GraphNode> | readonly GraphNode[]
    readonly groups?: ReadonlyMap<string, GraphGroup> | readonly GraphGroup[]
    readonly paths?: ReadonlyMap<string, GraphPath> | readonly GraphPath[]
    readonly shapeNodes?: ReadonlyMap<string, GraphShapeNode> | readonly GraphShapeNode[]
  },
  hostId: string,
): string[] {
  return listTransitiveFollowersMany(doc, [hostId])
}

/**
 * Transitive followers of any host in `hostIds` (one index build).
 * @param doc - document or scene projection with follow edges.
 * @param hostIds - host element ids.
 */
export function listTransitiveFollowersMany(
  doc: {
    readonly nodes: ReadonlyMap<string, GraphNode> | readonly GraphNode[]
    readonly groups?: ReadonlyMap<string, GraphGroup> | readonly GraphGroup[]
    readonly paths?: ReadonlyMap<string, GraphPath> | readonly GraphPath[]
    readonly shapeNodes?: ReadonlyMap<string, GraphShapeNode> | readonly GraphShapeNode[]
  },
  hostIds: readonly string[],
): string[] {
  if (hostIds.length === 0) return []
  const hostOf = collectHostOfLoose(doc)
  if (hostOf.size === 0) return []
  const followersOf = invertHostMap(hostOf)
  const out: string[] = []
  const seen = new Set<string>()
  const queue = [...hostIds]
  while (queue.length > 0) {
    const current = queue.shift()!
    const followers = followersOf.get(current)
    if (followers === undefined) continue
    for (const followerId of followers) {
      if (seen.has(followerId)) continue
      seen.add(followerId)
      out.push(followerId)
      queue.push(followerId)
    }
  }
  return out
}

/** Followers-of-host index used by live translate (built once per write batch). */
export type FollowersIndex = ReadonlyMap<string, readonly string[]>

/**
 * Build host→followers index from live scene maps.
 * @returns empty map when no element sets `followHostId`.
 */
export function buildFollowersIndex(args: {
  readonly nodes: ReadonlyMap<string, GraphNode>
  readonly groups: ReadonlyMap<string, GraphGroup>
  readonly paths: ReadonlyMap<string, GraphPath>
  readonly shapeNodes: ReadonlyMap<string, GraphShapeNode>
}): FollowersIndex {
  const hostOf = new Map<string, string>()
  for (const node of args.nodes.values()) {
    if (node.followHostId !== undefined) hostOf.set(node.id, node.followHostId)
  }
  for (const group of args.groups.values()) {
    if (group.followHostId !== undefined) hostOf.set(group.id, group.followHostId)
  }
  for (const path of args.paths.values()) {
    if (path.followHostId !== undefined) hostOf.set(path.id, path.followHostId)
  }
  for (const shape of args.shapeNodes.values()) {
    if (shape.followHostId !== undefined) hostOf.set(shape.id, shape.followHostId)
  }
  return invertHostMap(hostOf)
}

/**
 * Apply host moves to followers using one shared index (OCC / multi-select safe).
 * Builds the index once; no-ops when the graph has no follow edges.
 */
export function translateHostMovesLive(args: {
  readonly moves: readonly { readonly id: string; readonly dx: number; readonly dy: number }[]
  readonly skipIds: ReadonlySet<string>
  readonly nodes: Map<string, GraphNode>
  readonly groups: Map<string, GraphGroup>
  readonly paths: Map<string, GraphPath>
  readonly shapeNodes: Map<string, GraphShapeNode>
  readonly markDirty: (id: string) => void
}): void {
  if (args.moves.length === 0) return
  const followersOf = buildFollowersIndex(args)
  if (followersOf.size === 0) return
  for (const move of args.moves) {
    if (move.dx === 0 && move.dy === 0) continue
    translateFollowersWithIndex({
      hostId: move.id,
      dx: move.dx,
      dy: move.dy,
      skipIds: args.skipIds,
      followersOf,
      nodes: args.nodes,
      groups: args.groups,
      paths: args.paths,
      shapeNodes: args.shapeNodes,
      markDirty: args.markDirty,
    })
  }
}

/**
 * Apply `(dx, dy)` to every transitive follower of `hostId` that is not in
 * `skipIds`. Mutates the provided maps in place; caller marks dirty / versions.
 */
export function translateFollowersLive(args: {
  readonly hostId: string
  readonly dx: number
  readonly dy: number
  readonly skipIds: ReadonlySet<string>
  readonly nodes: Map<string, GraphNode>
  readonly groups: Map<string, GraphGroup>
  readonly paths: Map<string, GraphPath>
  readonly shapeNodes: Map<string, GraphShapeNode>
  readonly markDirty: (id: string) => void
  /** Optional prebuilt index; omit to scan maps once for this call. */
  readonly followersOf?: FollowersIndex
}): void {
  if (args.dx === 0 && args.dy === 0) return
  const followersOf = args.followersOf ?? buildFollowersIndex(args)
  if (followersOf.size === 0) return
  translateFollowersWithIndex({
    hostId: args.hostId,
    dx: args.dx,
    dy: args.dy,
    skipIds: args.skipIds,
    followersOf,
    nodes: args.nodes,
    groups: args.groups,
    paths: args.paths,
    shapeNodes: args.shapeNodes,
    markDirty: args.markDirty,
  })
}

function translateFollowersWithIndex(args: {
  readonly hostId: string
  readonly dx: number
  readonly dy: number
  readonly skipIds: ReadonlySet<string>
  readonly followersOf: FollowersIndex
  readonly nodes: Map<string, GraphNode>
  readonly groups: Map<string, GraphGroup>
  readonly paths: Map<string, GraphPath>
  readonly shapeNodes: Map<string, GraphShapeNode>
  readonly markDirty: (id: string) => void
}): void {
  const queue = [args.hostId]
  const applied = new Set<string>()
  while (queue.length > 0) {
    const hostId = queue.shift()!
    const followers = args.followersOf.get(hostId)
    if (followers === undefined) continue
    for (const followerId of followers) {
      if (args.skipIds.has(followerId)) continue
      if (applied.has(followerId)) continue
      applied.add(followerId)
      const node = args.nodes.get(followerId)
      if (node !== undefined) {
        args.nodes.set(followerId, {
          ...node,
          x: (node.x ?? 0) + args.dx,
          y: (node.y ?? 0) + args.dy,
        })
        args.markDirty(followerId)
        queue.push(followerId)
        continue
      }
      const group = args.groups.get(followerId)
      if (group !== undefined) {
        args.groups.set(followerId, {
          ...group,
          x: (group.x ?? 0) + args.dx,
          y: (group.y ?? 0) + args.dy,
        })
        args.markDirty(followerId)
        queue.push(followerId)
        continue
      }
      const path = args.paths.get(followerId)
      if (path !== undefined) {
        args.paths.set(followerId, {
          ...path,
          points: path.points.map(p => ({ x: p.x + args.dx, y: p.y + args.dy })),
        })
        args.markDirty(followerId)
        queue.push(followerId)
        continue
      }
      const shape = args.shapeNodes.get(followerId)
      if (shape !== undefined) {
        args.shapeNodes.set(followerId, {
          ...shape,
          points: shape.points.map(p => ({ x: p.x + args.dx, y: p.y + args.dy })),
        })
        args.markDirty(followerId)
        queue.push(followerId)
      }
    }
  }
}

function collectKindById(doc: GraphDocument): Map<string, FollowKind> {
  const map = new Map<string, FollowKind>()
  for (const node of doc.nodes) map.set(node.id, 'node')
  for (const group of doc.groups ?? []) map.set(group.id, 'group')
  for (const path of doc.paths ?? []) map.set(path.id, 'path')
  for (const shape of doc.shapeNodes ?? []) map.set(shape.id, 'shapeNode')
  return map
}

function collectHostOf(doc: GraphDocument): Map<string, string> {
  return collectHostOfLoose(doc)
}

function valuesOf<T>(
  collection: ReadonlyMap<string, T> | readonly T[] | undefined,
): Iterable<T> {
  if (collection === undefined) return []
  if (Array.isArray(collection)) return collection
  return (collection as ReadonlyMap<string, T>).values()
}

function collectHostOfLoose(doc: {
  readonly nodes: ReadonlyMap<string, GraphNode> | readonly GraphNode[]
  readonly groups?: ReadonlyMap<string, GraphGroup> | readonly GraphGroup[]
  readonly paths?: ReadonlyMap<string, GraphPath> | readonly GraphPath[]
  readonly shapeNodes?: ReadonlyMap<string, GraphShapeNode> | readonly GraphShapeNode[]
}): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of valuesOf(doc.nodes)) {
    if (node.followHostId !== undefined) map.set(node.id, node.followHostId)
  }
  for (const group of valuesOf(doc.groups)) {
    if (group.followHostId !== undefined) map.set(group.id, group.followHostId)
  }
  for (const path of valuesOf(doc.paths)) {
    if (path.followHostId !== undefined) map.set(path.id, path.followHostId)
  }
  for (const shape of valuesOf(doc.shapeNodes)) {
    if (shape.followHostId !== undefined) map.set(shape.id, shape.followHostId)
  }
  return map
}

function invertHostMap(hostOf: ReadonlyMap<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [id, hostId] of hostOf) {
    const list = out.get(hostId)
    if (list === undefined) out.set(hostId, [id])
    else list.push(id)
  }
  return out
}

function geometryTargetId(op: GraphPatchOp): string | undefined {
  switch (op.op) {
    case 'updateNode':
      if (op.patch.x !== undefined || op.patch.y !== undefined) return op.id
      return undefined
    case 'updateGroup':
      if (op.patch.x !== undefined || op.patch.y !== undefined) return op.id
      return undefined
    case 'updatePath':
      if (op.patch.points !== undefined) return op.id
      return undefined
    case 'updateShapeNode':
      if (op.patch.points !== undefined) return op.id
      return undefined
    default:
      return undefined
  }
}

function removeTargetId(op: GraphPatchOp): string | undefined {
  switch (op.op) {
    case 'removeNode':
    case 'removeGroup':
    case 'removePath':
    case 'removeShapeNode':
      return op.id
    default:
      return undefined
  }
}

function hostMotionDelta(
  doc: GraphDocument,
  op: GraphPatchOp,
): { id: string; dx: number; dy: number } | undefined {
  switch (op.op) {
    case 'updateNode': {
      if (op.patch.x === undefined && op.patch.y === undefined) return undefined
      const node = doc.nodes.find(n => n.id === op.id)
      if (node === undefined) return undefined
      const dx = (op.patch.x ?? node.x ?? 0) - (node.x ?? 0)
      const dy = (op.patch.y ?? node.y ?? 0) - (node.y ?? 0)
      return { id: op.id, dx, dy }
    }
    case 'updateGroup': {
      if (op.patch.x === undefined && op.patch.y === undefined) return undefined
      const group = (doc.groups ?? []).find(g => g.id === op.id)
      if (group === undefined) return undefined
      const dx = (op.patch.x ?? group.x ?? 0) - (group.x ?? 0)
      const dy = (op.patch.y ?? group.y ?? 0) - (group.y ?? 0)
      return { id: op.id, dx, dy }
    }
    case 'updatePath': {
      if (op.patch.points === undefined || op.patch.points.length === 0) return undefined
      const path = (doc.paths ?? []).find(p => p.id === op.id)
      if (path === undefined || path.points.length === 0) return undefined
      const from = path.points[0]!
      const to = op.patch.points[0]!
      return { id: op.id, dx: to.x - from.x, dy: to.y - from.y }
    }
    case 'updateShapeNode': {
      if (op.patch.points === undefined || op.patch.points.length === 0) return undefined
      const shape = (doc.shapeNodes ?? []).find(s => s.id === op.id)
      if (shape === undefined || shape.points.length === 0) return undefined
      const from = shape.points[0]!
      const to = op.patch.points[0]!
      return { id: op.id, dx: to.x - from.x, dy: to.y - from.y }
    }
    default:
      return undefined
  }
}

function translateFollowerOp(
  doc: GraphDocument,
  id: string,
  kind: FollowKind,
  dx: number,
  dy: number,
): GraphPatchOp | undefined {
  if (kind === 'node') {
    const node = doc.nodes.find(n => n.id === id)
    if (node === undefined) return undefined
    return {
      op: 'updateNode',
      id,
      patch: { x: (node.x ?? 0) + dx, y: (node.y ?? 0) + dy },
    }
  }
  if (kind === 'group') {
    const group = (doc.groups ?? []).find(g => g.id === id)
    if (group === undefined) return undefined
    return {
      op: 'updateGroup',
      id,
      patch: { x: (group.x ?? 0) + dx, y: (group.y ?? 0) + dy },
    }
  }
  if (kind === 'path') {
    const path = (doc.paths ?? []).find(p => p.id === id)
    if (path === undefined) return undefined
    return {
      op: 'updatePath',
      id,
      patch: { points: path.points.map(p => ({ x: p.x + dx, y: p.y + dy })) },
    }
  }
  const shape = (doc.shapeNodes ?? []).find(s => s.id === id)
  if (shape === undefined) return undefined
  return {
    op: 'updateShapeNode',
    id,
    patch: { points: shape.points.map(p => ({ x: p.x + dx, y: p.y + dy })) },
  }
}

function clearFollowOp(id: string, kind: FollowKind): GraphPatchOp {
  if (kind === 'node') return { op: 'updateNode', id, patch: { followHostId: null } }
  if (kind === 'group') return { op: 'updateGroup', id, patch: { followHostId: null } }
  if (kind === 'path') return { op: 'updatePath', id, patch: { followHostId: null } }
  return { op: 'updateShapeNode', id, patch: { followHostId: null } }
}

/**
 * Immutable GraphPatch application on GraphDocument.
 */

import { assertGroupParentAcyclic } from './parse.ts'
import { graphPatchSchema, type GraphPatch, type GraphPatchOp } from './schema.ts'
import type {
  Alarm,
  GraphDocument,
  GraphEdge,
  GraphEdgeStyle,
  GraphGroup,
  GraphGroupStyle,
  GraphNode,
  GraphNodeStyle,
} from './types.ts'

export type { GraphPatch, GraphPatchOp }

/**
 * Apply a structural patch to a document; returns a new document.
 * @param doc - current document (not mutated).
 * @param patch - ops list (validated).
 * @returns next document.
 * @throws on invalid patch or missing referents.
 */
export function applyPatch(doc: GraphDocument, patch: unknown): GraphDocument {
  const parsed = graphPatchSchema.safeParse(patch)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.') || '(root)'
    throw new Error(`GraphPatch parse failed at ${path}: ${issue?.message ?? 'invalid patch'}`)
  }
  let next = structuredClone(doc)
  for (const op of parsed.data.ops) {
    next = applyOp(next, op)
  }
  assertGroupParentAcyclic(next.groups ?? [])
  return next
}

function applyOp(doc: GraphDocument, op: GraphPatchOp): GraphDocument {
  switch (op.op) {
    case 'addNode': {
      if (doc.nodes.some(n => n.id === op.node.id)) {
        throw new Error(`addNode: duplicate id ${op.node.id}`)
      }
      if ((doc.groups ?? []).some(g => g.id === op.node.id)) {
        throw new Error(`addNode: id ${op.node.id} already used by a group`)
      }
      return { ...doc, nodes: [...doc.nodes, asNode(op.node)] }
    }
    case 'updateNode': {
      const index = doc.nodes.findIndex(n => n.id === op.id)
      if (index < 0) throw new Error(`updateNode: missing id ${op.id}`)
      const current = doc.nodes[index]!
      const nodes = doc.nodes.slice()
      nodes[index] = mergeNode(current, op.patch)
      return { ...doc, nodes }
    }
    case 'removeNode': {
      if (!doc.nodes.some(n => n.id === op.id)) {
        throw new Error(`removeNode: missing id ${op.id}`)
      }
      return {
        ...doc,
        nodes: doc.nodes.filter(n => n.id !== op.id),
        edges: doc.edges.filter(e => e.from !== op.id && e.to !== op.id),
      }
    }
    case 'addEdge': {
      if (doc.edges.some(e => e.id === op.edge.id)) {
        throw new Error(`addEdge: duplicate id ${op.edge.id}`)
      }
      assertEdgeEndpointsExist(doc, op.edge.from, op.edge.to, op.edge.id)
      const { style: rawStyle, ...edgeRest } = op.edge
      return {
        ...doc,
        edges: [...doc.edges, asEdge({
          ...edgeRest,
          ...(rawStyle !== undefined ? { style: asEdgeStyle(rawStyle) } : {}),
        })],
      }
    }
    case 'updateEdge': {
      const index = doc.edges.findIndex(e => e.id === op.id)
      if (index < 0) throw new Error(`updateEdge: missing id ${op.id}`)
      const current = doc.edges[index]!
      const edges = doc.edges.slice()
      const { style: rawStyle, ...patchRest } = op.patch
      edges[index] = mergeEdge(current, {
        ...patchRest,
        ...(rawStyle !== undefined ? { style: asEdgeStyle(rawStyle) } : {}),
      })
      return { ...doc, edges }
    }
    case 'removeEdge': {
      if (!doc.edges.some(e => e.id === op.id)) {
        throw new Error(`removeEdge: missing id ${op.id}`)
      }
      return { ...doc, edges: doc.edges.filter(e => e.id !== op.id) }
    }
    case 'addGroup': {
      if ((doc.groups ?? []).some(g => g.id === op.group.id)) {
        throw new Error(`addGroup: duplicate id ${op.group.id}`)
      }
      if (doc.nodes.some(n => n.id === op.group.id)) {
        throw new Error(`addGroup: id ${op.group.id} already used by a node`)
      }
      const { style: rawStyle, ...groupRest } = op.group
      return {
        ...doc,
        groups: [...(doc.groups ?? []), asGroup({
          ...groupRest,
          ...(rawStyle !== undefined ? { style: asGroupStyle(rawStyle) } : {}),
        })],
      }
    }
    case 'updateGroup': {
      const groups = doc.groups ?? []
      const index = groups.findIndex(g => g.id === op.id)
      if (index < 0) throw new Error(`updateGroup: missing id ${op.id}`)
      const current = groups[index]!
      const next = groups.slice()
      const { style: rawStyle, ...patchRest } = op.patch
      next[index] = mergeGroup(current, {
        ...patchRest,
        ...(rawStyle !== undefined ? { style: asGroupStyle(rawStyle) } : {}),
      })
      return { ...doc, groups: next }
    }
    case 'removeGroup': {
      const groups = doc.groups ?? []
      if (!groups.some(g => g.id === op.id)) {
        throw new Error(`removeGroup: missing id ${op.id}`)
      }
      return {
        ...doc,
        groups: groups.filter(g => g.id !== op.id),
        edges: doc.edges.filter(e => e.from !== op.id && e.to !== op.id),
      }
    }
    case 'setAlarms': {
      if (op.target === 'node') {
        return setNodeAlarms(doc, op.elementId, op.alarms.map(asAlarm))
      }
      return setEdgeAlarms(doc, op.elementId, op.alarms.map(asAlarm))
    }
    case 'setViewport':
      return { ...doc, viewport: op.viewport }
    case 'setSelection':
      return doc
    case 'enterSubNetwork':
    case 'exitSubNetwork':
      return doc
    default: {
      const _exhaustive: never = op
      throw new Error(`unhandled patch op: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function asAlarm(raw: {
  id: string
  level: Alarm['level']
  message: string
  ts?: string | undefined
}): Alarm {
  return raw.ts === undefined
    ? { id: raw.id, level: raw.level, message: raw.message }
    : { id: raw.id, level: raw.level, message: raw.message, ts: raw.ts }
}

function asNode(raw: {
  id: string
  type: string
  label: string
  label2?: string | undefined
  icon?: string | undefined
  tooltip?: string | undefined
  status?: string | undefined
  x?: number | undefined
  y?: number | undefined
  w?: number | undefined
  h?: number | undefined
  parentId?: string | undefined
  groupId?: string | undefined
  networkId?: string | undefined
  locked?: boolean | undefined
  alarms?: Array<{
    id: string
    level: Alarm['level']
    message: string
    ts?: string | undefined
  }> | undefined
  style?: object | undefined
  data?: Record<string, unknown> | undefined
}): GraphNode {
  const node: GraphNode = { id: raw.id, type: raw.type, label: raw.label }
  return applyOptionalNode(node, {
    label2: raw.label2,
    icon: raw.icon,
    tooltip: raw.tooltip,
    status: raw.status,
    x: raw.x,
    y: raw.y,
    w: raw.w,
    h: raw.h,
    parentId: raw.parentId,
    groupId: raw.groupId,
    networkId: raw.networkId,
    locked: raw.locked,
    alarms: raw.alarms,
    style: raw.style !== undefined ? asNodeStyle(raw.style) : undefined,
    data: raw.data,
  })
}

function mergeNode(
  current: GraphNode,
  patch: {
    type?: string | undefined
    label?: string | undefined
    label2?: string | undefined
    icon?: string | undefined
    tooltip?: string | undefined
    status?: string | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
    parentId?: string | undefined
    groupId?: string | null | undefined
    networkId?: string | undefined
    locked?: boolean | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | undefined
    style?: object | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphNode {
  const base: GraphNode = {
    id: current.id,
    type: patch.type ?? current.type,
    label: patch.label ?? current.label,
  }
  const groupId = patch.groupId === null
    ? undefined
    : (patch.groupId ?? current.groupId)
  return applyOptionalNode(base, {
    label2: patch.label2 ?? current.label2,
    icon: patch.icon ?? current.icon,
    tooltip: patch.tooltip ?? current.tooltip,
    status: patch.status ?? current.status,
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    w: patch.w ?? current.w,
    h: patch.h ?? current.h,
    parentId: patch.parentId ?? current.parentId,
    groupId,
    networkId: patch.networkId ?? current.networkId,
    locked: patch.locked ?? current.locked,
    alarms: patch.alarms ?? current.alarms?.map(a => ({ ...a })),
    style: patch.style !== undefined
      ? mergeNodeStyle(current.style, asNodeStyle(patch.style))
      : current.style,
    data: patch.data ?? (current.data !== undefined ? { ...current.data } : undefined),
  })
}

/** One-level style merge: top keys overwrite; nested objects replace as units. */
function mergeNodeStyle(
  current: GraphNodeStyle | undefined,
  patch: GraphNodeStyle,
): GraphNodeStyle {
  return { ...(current ?? {}), ...patch }
}

/** Normalize zod style bags under exactOptionalPropertyTypes. */
function asNodeStyle(raw: object): GraphNodeStyle {
  return raw as GraphNodeStyle
}

function applyOptionalNode(
  node: GraphNode,
  raw: {
    label2?: string | undefined
    icon?: string | undefined
    tooltip?: string | undefined
    status?: string | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
    parentId?: string | undefined
    groupId?: string | undefined
    networkId?: string | undefined
    locked?: boolean | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | readonly Alarm[] | undefined
    style?: GraphNodeStyle | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphNode {
  return {
    ...node,
    ...(raw.label2 !== undefined ? { label2: raw.label2 } : {}),
    ...(raw.icon !== undefined ? { icon: raw.icon } : {}),
    ...(raw.tooltip !== undefined ? { tooltip: raw.tooltip } : {}),
    ...(raw.status !== undefined ? { status: raw.status } : {}),
    ...(raw.x !== undefined ? { x: raw.x } : {}),
    ...(raw.y !== undefined ? { y: raw.y } : {}),
    ...(raw.w !== undefined ? { w: raw.w } : {}),
    ...(raw.h !== undefined ? { h: raw.h } : {}),
    ...(raw.parentId !== undefined ? { parentId: raw.parentId } : {}),
    ...(raw.groupId !== undefined ? { groupId: raw.groupId } : {}),
    ...(raw.networkId !== undefined ? { networkId: raw.networkId } : {}),
    ...(raw.locked !== undefined ? { locked: raw.locked } : {}),
    ...(raw.alarms !== undefined ? { alarms: [...raw.alarms].map(asAlarm) } : {}),
    ...(raw.style !== undefined ? { style: raw.style } : {}),
    ...(raw.data !== undefined ? { data: raw.data } : {}),
  }
}

function asEdge(raw: {
  id: string
  from: string
  to: string
  kind?: string | undefined
  waypoints?: Array<{ x: number; y: number }> | undefined
  shapePoints?: Array<{ x: number; y: number }> | undefined
  fromAnchor?: GraphEdge['fromAnchor']
  toAnchor?: GraphEdge['toAnchor']
  fromOutset?: number | undefined
  toOutset?: number | undefined
  label?: string | undefined
  label2?: string | undefined
  tooltip?: string | undefined
  alarms?: Array<{
    id: string
    level: Alarm['level']
    message: string
    ts?: string | undefined
  }> | undefined
  style?: GraphEdgeStyle | undefined
  data?: Record<string, unknown> | undefined
}): GraphEdge {
  return {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    ...(raw.kind !== undefined ? { kind: raw.kind } : {}),
    ...(raw.waypoints !== undefined
      ? { waypoints: raw.waypoints.map(p => ({ x: p.x, y: p.y })) }
      : {}),
    ...(raw.shapePoints !== undefined
      ? { shapePoints: raw.shapePoints.map(p => ({ x: p.x, y: p.y })) }
      : {}),
    ...(raw.fromAnchor !== undefined ? { fromAnchor: raw.fromAnchor } : {}),
    ...(raw.toAnchor !== undefined ? { toAnchor: raw.toAnchor } : {}),
    ...(raw.fromOutset !== undefined ? { fromOutset: raw.fromOutset } : {}),
    ...(raw.toOutset !== undefined ? { toOutset: raw.toOutset } : {}),
    ...(raw.label !== undefined ? { label: raw.label } : {}),
    ...(raw.label2 !== undefined ? { label2: raw.label2 } : {}),
    ...(raw.tooltip !== undefined ? { tooltip: raw.tooltip } : {}),
    ...(raw.alarms !== undefined ? { alarms: raw.alarms.map(asAlarm) } : {}),
    ...(raw.style !== undefined ? { style: asEdgeStyle(raw.style) } : {}),
    ...(raw.data !== undefined ? { data: raw.data } : {}),
  }
}

function mergeEdge(
  current: GraphEdge,
  patch: {
    from?: string | undefined
    to?: string | undefined
    kind?: string | undefined
    waypoints?: Array<{ x: number; y: number }> | undefined
    shapePoints?: Array<{ x: number; y: number }> | undefined
    fromAnchor?: GraphEdge['fromAnchor']
    toAnchor?: GraphEdge['toAnchor']
    fromOutset?: number | undefined
    toOutset?: number | undefined
    label?: string | undefined
    label2?: string | undefined
    tooltip?: string | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | undefined
    style?: GraphEdgeStyle | undefined
    data?: Record<string, unknown> | undefined
  },
): GraphEdge {
  const waypoints = patch.waypoints !== undefined
    ? patch.waypoints
    : current.waypoints !== undefined
      ? current.waypoints.map(p => ({ x: p.x, y: p.y }))
      : undefined
  const shapePoints = patch.shapePoints !== undefined
    ? patch.shapePoints
    : current.shapePoints !== undefined
      ? current.shapePoints.map(p => ({ x: p.x, y: p.y }))
      : undefined
  const edge = asEdge({
    id: current.id,
    from: patch.from ?? current.from,
    to: patch.to ?? current.to,
    kind: patch.kind ?? current.kind,
    ...(waypoints !== undefined ? { waypoints } : {}),
    ...(shapePoints !== undefined ? { shapePoints } : {}),
    fromAnchor: patch.fromAnchor ?? current.fromAnchor,
    toAnchor: patch.toAnchor ?? current.toAnchor,
    fromOutset: patch.fromOutset ?? current.fromOutset,
    toOutset: patch.toOutset ?? current.toOutset,
    label: patch.label ?? current.label,
    label2: patch.label2 ?? current.label2,
    tooltip: patch.tooltip ?? current.tooltip,
    alarms: patch.alarms ?? current.alarms?.map(a => ({ ...a })),
    style: patch.style !== undefined
      ? mergeEdgeStyle(current.style, asEdgeStyle(patch.style))
      : current.style,
    data: patch.data ?? (current.data !== undefined ? { ...current.data } : undefined),
  })
  // Empty waypoints clear custom routing back to auto.
  if (patch.waypoints !== undefined && patch.waypoints.length === 0) {
    const { waypoints: _cleared, ...rest } = edge
    void _cleared
    return rest
  }
  if (patch.shapePoints !== undefined && patch.shapePoints.length === 0) {
    const { shapePoints: _cleared, ...rest } = edge
    void _cleared
    return rest
  }
  return edge
}

/** One-level style merge: top keys overwrite; nested objects replace as units. */
function mergeEdgeStyle(
  current: GraphEdgeStyle | undefined,
  patch: GraphEdgeStyle,
): GraphEdgeStyle {
  return { ...(current ?? {}), ...patch }
}

/** Normalize zod style bags under exactOptionalPropertyTypes. */
function asEdgeStyle(raw: object): GraphEdgeStyle {
  return raw as GraphEdgeStyle
}

function asGroup(raw: {
  id: string
  label: string
  label2?: string | undefined
  tooltip?: string | undefined
  memberIds: readonly string[]
  parentId?: string | undefined
  expanded?: boolean | undefined
  x?: number | undefined
  y?: number | undefined
  w?: number | undefined
  h?: number | undefined
  locked?: boolean | undefined
  icon?: string | undefined
  alarms?: Array<{
    id: string
    level: Alarm['level']
    message: string
    ts?: string | undefined
  }> | undefined
  style?: GraphGroupStyle | undefined
  data?: Readonly<Record<string, unknown>> | undefined
}): GraphGroup {
  return {
    id: raw.id,
    label: raw.label,
    memberIds: [...raw.memberIds],
    ...(raw.label2 !== undefined ? { label2: raw.label2 } : {}),
    ...(raw.tooltip !== undefined ? { tooltip: raw.tooltip } : {}),
    ...(raw.parentId !== undefined ? { parentId: raw.parentId } : {}),
    ...(raw.expanded !== undefined ? { expanded: raw.expanded } : {}),
    ...(raw.x !== undefined ? { x: raw.x } : {}),
    ...(raw.y !== undefined ? { y: raw.y } : {}),
    ...(raw.w !== undefined ? { w: raw.w } : {}),
    ...(raw.h !== undefined ? { h: raw.h } : {}),
    ...(raw.locked !== undefined ? { locked: raw.locked } : {}),
    ...(raw.icon !== undefined ? { icon: raw.icon } : {}),
    ...(raw.alarms !== undefined ? { alarms: raw.alarms.map(asAlarm) } : {}),
    ...(raw.style !== undefined ? { style: asGroupStyle(raw.style) } : {}),
    ...(raw.data !== undefined ? { data: raw.data } : {}),
  }
}

function mergeGroup(
  current: GraphGroup,
  patch: {
    label?: string | undefined
    label2?: string | undefined
    tooltip?: string | undefined
    memberIds?: readonly string[] | undefined
    parentId?: string | undefined
    expanded?: boolean | undefined
    x?: number | undefined
    y?: number | undefined
    w?: number | undefined
    h?: number | undefined
    locked?: boolean | undefined
    icon?: string | undefined
    alarms?: Array<{
      id: string
      level: Alarm['level']
      message: string
      ts?: string | undefined
    }> | undefined
    style?: GraphGroupStyle | undefined
    data?: Readonly<Record<string, unknown>> | undefined
  },
): GraphGroup {
  return asGroup({
    id: current.id,
    label: patch.label ?? current.label,
    label2: patch.label2 ?? current.label2,
    tooltip: patch.tooltip ?? current.tooltip,
    memberIds: patch.memberIds ?? current.memberIds,
    parentId: patch.parentId ?? current.parentId,
    expanded: patch.expanded ?? current.expanded,
    x: patch.x ?? current.x,
    y: patch.y ?? current.y,
    w: patch.w ?? current.w,
    h: patch.h ?? current.h,
    locked: patch.locked ?? current.locked,
    icon: patch.icon ?? current.icon,
    alarms: patch.alarms ?? current.alarms?.map(a => ({
      id: a.id,
      level: a.level,
      message: a.message,
      ...(a.ts !== undefined ? { ts: a.ts } : {}),
    })),
    style: patch.style !== undefined
      ? mergeGroupStyle(current.style, asGroupStyle(patch.style))
      : current.style,
    data: patch.data ?? current.data,
  })
}

/** One-level style merge: top keys overwrite; nested objects replace as units. */
function mergeGroupStyle(
  current: GraphGroupStyle | undefined,
  patch: GraphGroupStyle,
): GraphGroupStyle {
  return { ...(current ?? {}), ...patch }
}

/** Normalize zod style bags under exactOptionalPropertyTypes. */
function asGroupStyle(raw: object): GraphGroupStyle {
  return raw as GraphGroupStyle
}

/**
 * Fail loud when addEdge endpoints are neither node nor group ids.
 * @param doc - current document.
 * @param from - source endpoint id.
 * @param to - target endpoint id.
 * @param edgeId - edge id for error text.
 */
function assertEdgeEndpointsExist(
  doc: GraphDocument,
  from: string,
  to: string,
  edgeId: string,
): void {
  const nodeIds = new Set(doc.nodes.map(n => n.id))
  const groupIds = new Set((doc.groups ?? []).map(g => g.id))
  for (const [side, id] of [['from', from], ['to', to]] as const) {
    if (nodeIds.has(id) || groupIds.has(id)) continue
    throw new Error(
      `addEdge: edge ${edgeId} ${side} "${id}" is not a node or group id`,
    )
  }
}

function setNodeAlarms(doc: GraphDocument, id: string, alarms: readonly Alarm[]): GraphDocument {
  const index = doc.nodes.findIndex(n => n.id === id)
  if (index < 0) throw new Error(`setAlarms: missing node ${id}`)
  const nodes = doc.nodes.slice()
  const current = nodes[index]!
  nodes[index] = { ...current, alarms: [...alarms] }
  return { ...doc, nodes }
}

function setEdgeAlarms(doc: GraphDocument, id: string, alarms: readonly Alarm[]): GraphDocument {
  const index = doc.edges.findIndex(e => e.id === id)
  if (index < 0) throw new Error(`setAlarms: missing edge ${id}`)
  const edges = doc.edges.slice()
  const current = edges[index]!
  edges[index] = { ...current, alarms: [...alarms] }
  return { ...doc, edges }
}

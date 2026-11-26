/**
 * Parse unknown JSON into a GraphDocument; fail loud on invalid input.
 */

import { graphDocumentSchema } from './schema.ts'
import type { GraphDocument, GraphGroup } from './types.ts'

/**
 * Validate and return a GraphDocument.
 * @param input - unknown JSON value.
 * @returns parsed document.
 * @throws when validation fails.
 */
export function parseDocument(input: unknown): GraphDocument {
  const result = graphDocumentSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue?.path.join('.') || '(root)'
    const message = issue?.message ?? 'invalid document'
    throw new Error(`GraphDocument parse failed at ${path}: ${message}`)
  }
  assertGroupParentAcyclic(result.data.groups ?? [])
  assertEndpointIds(result.data)
  assertNoCrossKindIdClash(result.data)
  return result.data
}

/**
 * Fail loud when an edge endpoint is neither a node nor a group.
 * @param doc - parsed document.
 */
export function assertEndpointIds(doc: GraphDocument): void {
  const nodeIds = new Set(doc.nodes.map(n => n.id))
  const groupIds = new Set((doc.groups ?? []).map(g => g.id))
  for (const edge of doc.edges) {
    for (const side of ['from', 'to'] as const) {
      const id = edge[side]
      if (nodeIds.has(id) || groupIds.has(id)) continue
      throw new Error(
        `GraphEdge ${edge.id}: ${side} "${id}" is not a node or group id`,
      )
    }
  }
}

/**
 * Fail loud when element ids collide across kinds (node / edge / group / path)
 * or when the same kind repeats an id.
 * @param doc - parsed document.
 */
export function assertNoCrossKindIdClash(doc: GraphDocument): void {
  const groupIds = new Set((doc.groups ?? []).map(g => g.id))
  for (const node of doc.nodes) {
    if (!groupIds.has(node.id)) continue
    throw new Error(`id "${node.id}" is used by both a node and a group`)
  }

  const nodeIds = new Set(doc.nodes.map(n => n.id))
  const edgeIds = new Set(doc.edges.map(e => e.id))
  const pathIds = new Set<string>()
  for (const path of doc.paths ?? []) {
    if (pathIds.has(path.id)) {
      throw new Error(`duplicate path id "${path.id}"`)
    }
    pathIds.add(path.id)
    if (nodeIds.has(path.id)) {
      throw new Error(`id "${path.id}" is used by both a path and a node`)
    }
    if (edgeIds.has(path.id)) {
      throw new Error(`id "${path.id}" is used by both a path and an edge`)
    }
    if (groupIds.has(path.id)) {
      throw new Error(`id "${path.id}" is used by both a path and a group`)
    }
  }
}

/**
 * Fail loud when `parentId` forms a cycle or points at a missing group.
 * @param groups - document groups.
 */
export function assertGroupParentAcyclic(groups: readonly GraphGroup[]): void {
  const byId = new Map(groups.map(g => [g.id, g] as const))
  for (const group of groups) {
    if (group.parentId === undefined) continue
    if (group.parentId === group.id) {
      throw new Error(`GraphGroup ${group.id}: parentId cannot reference itself`)
    }
    if (!byId.has(group.parentId)) {
      throw new Error(`GraphGroup ${group.id}: parentId ${group.parentId} not found`)
    }
    let walk: string | undefined = group.parentId
    const seen = new Set<string>([group.id])
    while (walk !== undefined) {
      if (seen.has(walk)) {
        throw new Error(`GraphGroup ${group.id}: parentId cycle via ${walk}`)
      }
      seen.add(walk)
      walk = byId.get(walk)?.parentId
    }
  }
}

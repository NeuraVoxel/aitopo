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
  return result.data
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

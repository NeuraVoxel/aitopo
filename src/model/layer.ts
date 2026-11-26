/**
 * Document layers (twaver Layer / LayerBox ideas; clean-room).
 * Array order = paint bottom → top. Omitted element `layerId` → `default`.
 */

import type { GraphDocument, GraphLayer } from '../protocol/types.ts'

/** Implicit layer id when `layerId` is omitted (twaver `LAYER_DEFAULT_ID`). */
export const DEFAULT_LAYER_ID = 'default'

const DEFAULT_LAYER: GraphLayer = {
  id: DEFAULT_LAYER_ID,
  name: 'default',
}

/**
 * Fail loud on duplicate layer ids or element `layerId` not in the document.
 * Omitted `layers` / empty array → only the implicit default is valid.
 * @param doc - document after parse or patch apply.
 */
export function assertLayerIdsValid(doc: GraphDocument): void {
  const declared = doc.layers ?? []
  const seen = new Set<string>()
  for (const layer of declared) {
    if (seen.has(layer.id)) {
      throw new Error(`GraphLayer: duplicate id "${layer.id}"`)
    }
    seen.add(layer.id)
  }
  const known = resolveLayerIndex(doc)
  for (const el of listLayeredElements(doc)) {
    const layerId = el.layerId ?? DEFAULT_LAYER_ID
    if (!known.has(layerId)) {
      throw new Error(
        `layerId: ${el.kind} ${el.id} references unknown layer "${layerId}"`,
      )
    }
  }
}

/**
 * Paint / policy layers bottom → top.
 * Omitted or empty `layers` → single synthetic default.
 * Declared list without `default` gets a synthetic default prepended (bottom).
 * @param doc - active document.
 */
export function listPaintLayers(doc: GraphDocument): readonly GraphLayer[] {
  const declared = doc.layers ?? []
  if (declared.length === 0) return [DEFAULT_LAYER]
  if (declared.some(l => l.id === DEFAULT_LAYER_ID)) return declared
  return [DEFAULT_LAYER, ...declared]
}

/**
 * Resolve the layer record for an element id (or a raw `layerId`).
 * Unknown layer ids fall back to default only when looking up by missing
 * element; validation already fails loud for bad `layerId` on load/apply.
 * @param doc - active document.
 * @param layerId - element `layerId` or omitted.
 */
export function resolveLayer(
  doc: GraphDocument,
  layerId: string | undefined,
): GraphLayer {
  const id = layerId ?? DEFAULT_LAYER_ID
  for (const layer of listPaintLayers(doc)) {
    if (layer.id === id) return layer
  }
  return DEFAULT_LAYER
}

/** Whether the layer paints and participates in hit-test. Omitted ≡ `true`. */
export function isLayerVisible(layer: GraphLayer): boolean {
  return layer.visible !== false
}

/** Whether elements on the layer may be dragged. Omitted ≡ `true`. */
export function isLayerMovable(layer: GraphLayer): boolean {
  return layer.movable !== false
}

/** Whether elements on the layer accept edit chrome. Omitted ≡ `true`. */
export function isLayerEditable(layer: GraphLayer): boolean {
  return layer.editable !== false
}

function resolveLayerIndex(doc: GraphDocument): ReadonlySet<string> {
  const ids = new Set<string>([DEFAULT_LAYER_ID])
  for (const layer of doc.layers ?? []) ids.add(layer.id)
  return ids
}

function listLayeredElements(doc: GraphDocument): readonly {
  readonly id: string
  readonly kind: string
  readonly layerId?: string
}[] {
  const out: { id: string; kind: string; layerId?: string }[] = []
  for (const node of doc.nodes) {
    out.push({ id: node.id, kind: 'node', ...(node.layerId !== undefined ? { layerId: node.layerId } : {}) })
  }
  for (const edge of doc.edges) {
    out.push({ id: edge.id, kind: 'edge', ...(edge.layerId !== undefined ? { layerId: edge.layerId } : {}) })
  }
  for (const group of doc.groups ?? []) {
    out.push({
      id: group.id,
      kind: 'group',
      ...(group.layerId !== undefined ? { layerId: group.layerId } : {}),
    })
  }
  for (const path of doc.paths ?? []) {
    out.push({
      id: path.id,
      kind: 'path',
      ...(path.layerId !== undefined ? { layerId: path.layerId } : {}),
    })
  }
  for (const shapeNode of doc.shapeNodes ?? []) {
    out.push({
      id: shapeNode.id,
      kind: 'shapeNode',
      ...(shapeNode.layerId !== undefined ? { layerId: shapeNode.layerId } : {}),
    })
  }
  return out
}

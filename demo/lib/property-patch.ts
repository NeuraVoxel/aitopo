/**
 * Write-back level A: demo form fields → GraphPatch update ops.
 * Invalid `dataJson` or `labelPosition` throw; inapplicable fields are omitted.
 */

import type {
  AttachmentPosition,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphPatch,
  GraphPatchOp,
  GraphTextStyle,
} from '../../src/index.ts'

export type PropTarget =
  | { kind: 'node'; element: GraphNode }
  | { kind: 'edge'; element: GraphEdge }
  | { kind: 'group'; element: GraphGroup }

export interface PropertyFields {
  label?: string
  x?: number
  y?: number
  w?: number
  h?: number
  type?: string
  kind?: string
  expanded?: boolean
  labelPosition?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  labelColor?: string
  labelFontSize?: number
  /** JSON object of string values; invalid JSON throws. */
  dataJson?: string
}

export const LABEL_POSITIONS = [
  'top',
  'bottom',
  'left',
  'right',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
  'center',
  'insideTop',
  'insideTopLeft',
  'insideTopRight',
  'insideBottom',
] as const satisfies readonly AttachmentPosition[]

type NodeUpdate = Extract<GraphPatchOp, { op: 'updateNode' }>['patch']
type EdgeUpdate = Extract<GraphPatchOp, { op: 'updateEdge' }>['patch']
type GroupUpdate = Extract<GraphPatchOp, { op: 'updateGroup' }>['patch']

/**
 * Build one `updateNode` / `updateEdge` / `updateGroup` op from changed fields.
 * @param target - selected element and its kind.
 * @param fields - subset to write; omitted keys are left unchanged.
 * @returns GraphPatch with a single update op.
 * @throws when `dataJson` is invalid or not a string map, or `labelPosition` is unknown.
 */
export function buildPropertyPatch(target: PropTarget, fields: PropertyFields): GraphPatch {
  switch (target.kind) {
    case 'node':
      return {
        ops: [{
          op: 'updateNode',
          id: target.element.id,
          patch: nodePatch(target.element, fields),
        }],
      }
    case 'edge':
      return {
        ops: [{ op: 'updateEdge', id: target.element.id, patch: edgePatch(target.element, fields) }],
      }
    case 'group':
      return {
        ops: [{ op: 'updateGroup', id: target.element.id, patch: groupPatch(target.element, fields) }],
      }
    default: {
      const _e: never = target
      throw new Error(`unhandled PropTarget: ${JSON.stringify(_e)}`)
    }
  }
}

function nodePatch(element: GraphNode, fields: PropertyFields): NodeUpdate {
  const patch: Record<string, unknown> = {}
  assignCommonGeometry(patch, fields)
  if (fields.label !== undefined) patch.label = fields.label
  if (fields.type !== undefined) patch.type = fields.type
  const label = mergeLabelText(element.style?.label, fields)
  const style: Record<string, unknown> = {}
  if (fields.labelPosition !== undefined) {
    style.labelPosition = asLabelPosition(fields.labelPosition)
  }
  if (label !== undefined) style.label = label
  if (Object.keys(style).length > 0) patch.style = style
  if (fields.dataJson !== undefined) patch.data = parseDataJson(fields.dataJson)
  return patch as NodeUpdate
}

function edgePatch(element: GraphEdge, fields: PropertyFields): EdgeUpdate {
  const patch: Record<string, unknown> = {}
  if (fields.label !== undefined) patch.label = fields.label
  if (fields.kind !== undefined) patch.kind = fields.kind
  const label = mergeLabelText(element.style?.label, fields)
  const style: Record<string, unknown> = {}
  if (fields.stroke !== undefined) style.stroke = fields.stroke
  if (fields.strokeWidth !== undefined) style.lineWidth = fields.strokeWidth
  if (label !== undefined) style.label = label
  if (Object.keys(style).length > 0) patch.style = style
  if (fields.dataJson !== undefined) patch.data = parseDataJson(fields.dataJson)
  return patch as EdgeUpdate
}

function groupPatch(element: GraphGroup, fields: PropertyFields): GroupUpdate {
  const patch: Record<string, unknown> = {}
  assignCommonGeometry(patch, fields)
  if (fields.label !== undefined) patch.label = fields.label
  if (fields.expanded !== undefined) patch.expanded = fields.expanded
  const label = mergeLabelText(element.style?.label, fields)
  const style: Record<string, unknown> = {}
  if (fields.fill !== undefined) style.fill = fields.fill
  if (fields.stroke !== undefined) style.stroke = fields.stroke
  if (fields.strokeWidth !== undefined) style.strokeWidth = fields.strokeWidth
  if (fields.labelPosition !== undefined) {
    style.labelPosition = asLabelPosition(fields.labelPosition)
  }
  if (label !== undefined) style.label = label
  if (Object.keys(style).length > 0) patch.style = style
  if (fields.dataJson !== undefined) patch.data = parseDataJson(fields.dataJson)
  return patch as GroupUpdate
}

function assignCommonGeometry(patch: Record<string, unknown>, fields: PropertyFields): void {
  if (fields.x !== undefined) patch.x = fields.x
  if (fields.y !== undefined) patch.y = fields.y
  if (fields.w !== undefined) patch.w = fields.w
  if (fields.h !== undefined) patch.h = fields.h
}

function mergeLabelText(
  current: GraphTextStyle | undefined,
  fields: PropertyFields,
): GraphTextStyle | undefined {
  if (fields.labelColor === undefined && fields.labelFontSize === undefined) return undefined
  return {
    ...(current ?? {}),
    ...(fields.labelColor !== undefined ? { color: fields.labelColor } : {}),
    ...(fields.labelFontSize !== undefined ? { fontSize: fields.labelFontSize } : {}),
  }
}

function asLabelPosition(value: string): AttachmentPosition {
  if (!(LABEL_POSITIONS as readonly string[]).includes(value)) {
    throw new Error(`Invalid labelPosition: ${value}`)
  }
  return value as AttachmentPosition
}

/**
 * @param raw - JSON text from the property form.
 * @returns string-only data bag.
 * @throws when JSON is invalid or any value is not a string.
 */
export function parseDataJson(raw: string): Record<string, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('dataJson must be valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('dataJson must be an object of string values')
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error('dataJson must be an object of string values')
    }
    out[key] = value
  }
  return out
}

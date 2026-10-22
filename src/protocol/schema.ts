/**
 * Zod schemas for GraphDocument and GraphPatch at the protocol boundary.
 */

import { z } from 'zod'

const alarmSchema = z.object({
  id: z.string().min(1),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  ts: z.string().optional(),
})

const attachmentPositionSchema = z.enum([
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
])

const graphTextStyleSchema = z.object({
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  /** `0` = never truncate; omitted → host default. */
  maxChars: z.number().int().nonnegative().optional(),
})

const graphChromeStyleSchema = z.object({
  color: z.string().optional(),
  width: z.number().positive().optional(),
  padding: z.number().nonnegative().optional(),
})

const graphShadowStyleSchema = z.object({
  color: z.string().optional(),
  blur: z.number().nonnegative().optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
})

const alarmVariantSchema = z.enum(['dot', 'tag'])

const graphNodeStyleSchema = z.object({
  labelPosition: attachmentPositionSchema.optional(),
  label2Position: attachmentPositionSchema.optional(),
  tooltipPosition: attachmentPositionSchema.optional(),
  alarmPosition: attachmentPositionSchema.optional(),
  alarmVariant: alarmVariantSchema.optional(),
  tooltipMode: z.enum(['hover', 'always']).optional(),
  alpha: z.number().min(0).max(1).optional(),
  showIcon: z.boolean().optional(),
  label: graphTextStyleSchema.optional(),
  label2: graphTextStyleSchema.optional(),
  tooltip: graphTextStyleSchema.optional(),
  alarm: graphTextStyleSchema.optional(),
  strokeDash: z.array(z.number()).optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
  shadow: graphShadowStyleSchema.optional(),
})

const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string(),
  label2: z.string().optional(),
  icon: z.string().min(1).optional(),
  tooltip: z.string().optional(),
  status: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  parentId: z.string().optional(),
  groupId: z.string().optional(),
  networkId: z.string().optional(),
  locked: z.boolean().optional(),
  alarms: z.array(alarmSchema).optional(),
  style: graphNodeStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphEdgeArrowStyleSchema = z.object({
  size: z.number().positive().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
})

const graphEdgeStyleSchema = z.object({
  stroke: z.string().optional(),
  strokeHover: z.string().optional(),
  lineWidth: z.number().positive().optional(),
  strokeDash: z.array(z.number()).optional(),
  alpha: z.number().min(0).max(1).optional(),
  labelAt: z.number().min(0).max(1).optional(),
  label2At: z.number().min(0).max(1).optional(),
  alarmAt: z.number().min(0).max(1).optional(),
  tooltipAt: z.number().min(0).max(1).optional(),
  tooltipMode: z.enum(['hover', 'always']).optional(),
  labelSide: z.enum(['pathLeft', 'pathRight', 'aboveOrRight']).optional(),
  label: graphTextStyleSchema.optional(),
  label2: graphTextStyleSchema.optional(),
  tooltip: graphTextStyleSchema.optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
  arrowFrom: z.boolean().optional(),
  arrowTo: z.boolean().optional(),
  arrow: graphEdgeArrowStyleSchema.optional(),
})

const graphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().optional(),
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  fromAnchor: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  toAnchor: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  label: z.string().optional(),
  label2: z.string().optional(),
  tooltip: z.string().optional(),
  alarms: z.array(alarmSchema).optional(),
  style: graphEdgeStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphGroupStyleSchema = z.object({
  stroke: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  strokeDash: z.array(z.number()).optional(),
  fill: z.string().optional(),
  alpha: z.number().min(0).max(1).optional(),
  padding: z.number().nonnegative().optional(),
  paddingTop: z.number().nonnegative().optional(),
  autoFit: z.boolean().optional(),
  shape: z.literal('rectangle').optional(),
  labelPosition: attachmentPositionSchema.optional(),
  label2Position: attachmentPositionSchema.optional(),
  tooltipPosition: attachmentPositionSchema.optional(),
  alarmPosition: attachmentPositionSchema.optional(),
  alarmVariant: alarmVariantSchema.optional(),
  tooltipMode: z.enum(['hover', 'always']).optional(),
  label: graphTextStyleSchema.optional(),
  label2: graphTextStyleSchema.optional(),
  tooltip: graphTextStyleSchema.optional(),
  alarm: graphTextStyleSchema.optional(),
  showIcon: z.boolean().optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
  shadow: graphShadowStyleSchema.optional(),
})

const graphGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  label2: z.string().optional(),
  tooltip: z.string().optional(),
  memberIds: z.array(z.string()),
  parentId: z.string().min(1).optional(),
  expanded: z.boolean().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  locked: z.boolean().optional(),
  icon: z.string().min(1).optional(),
  alarms: z.array(alarmSchema).optional(),
  style: graphGroupStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
})

const graphMetaSchema = z.object({
  title: z.string().optional(),
  kind: z.enum(['topology', 'flow', 'custom']).optional(),
}).passthrough()

/** Lazy document schema so nested `networks` can recurse. */
export const graphDocumentSchema: z.ZodType<import('./types.ts').GraphDocument> = z.lazy(() =>
  z.object({
    version: z.literal(1),
    meta: graphMetaSchema.optional(),
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
    groups: z.array(graphGroupSchema).optional(),
    networks: z.record(z.string(), graphDocumentSchema).optional(),
    viewport: graphViewportSchema.optional(),
  }),
) as z.ZodType<import('./types.ts').GraphDocument>

const patchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addNode'), node: graphNodeSchema }),
  z.object({
    op: z.literal('updateNode'),
    id: z.string().min(1),
    patch: graphNodeSchema.partial().omit({ id: true }).extend({
      /** `null` clears membership (`groupId` omitted). */
      groupId: z.union([z.string().min(1), z.null()]).optional(),
    }),
  }),
  z.object({ op: z.literal('removeNode'), id: z.string().min(1) }),
  z.object({ op: z.literal('addEdge'), edge: graphEdgeSchema }),
  z.object({ op: z.literal('updateEdge'), id: z.string().min(1), patch: graphEdgeSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeEdge'), id: z.string().min(1) }),
  z.object({ op: z.literal('addGroup'), group: graphGroupSchema }),
  z.object({ op: z.literal('updateGroup'), id: z.string().min(1), patch: graphGroupSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeGroup'), id: z.string().min(1) }),
  z.object({
    op: z.literal('setAlarms'),
    elementId: z.string().min(1),
    target: z.enum(['node', 'edge']),
    alarms: z.array(alarmSchema),
  }),
  z.object({ op: z.literal('setViewport'), viewport: graphViewportSchema }),
  z.object({ op: z.literal('setSelection'), selectedIds: z.array(z.string()) }),
  z.object({ op: z.literal('enterSubNetwork'), id: z.string().min(1) }),
  z.object({ op: z.literal('exitSubNetwork') }),
])

/** Validated patch payload: ordered ops applied atomically. */
export const graphPatchSchema = z.object({
  ops: z.array(patchOpSchema).min(1),
})

export type GraphPatchOp = z.infer<typeof patchOpSchema>
export type GraphPatch = z.infer<typeof graphPatchSchema>

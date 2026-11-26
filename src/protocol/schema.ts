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
  glow: z.boolean().optional(),
  glowBlur: z.number().nonnegative().optional(),
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

const edgeRouteSchema = z.enum([
  'orthogonal',
  'orthogonalHV',
  'orthogonalVH',
  'orthogonalHorizontal',
  'orthogonalVertical',
  'flexional',
  'flexionalHorizontal',
  'flexionalVertical',
  'extendTop',
  'extendLeft',
  'extendBottom',
  'extendRight',
  'straight',
  'arc',
  'bundleArc',
  'triangle',
  'parallel',
  'shape',
])

const graphEdgeArrowStyleSchema = z.object({
  size: z.number().positive().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  shape: z.enum(['standard', 'delta', 'diamond', 'short', 'slant']).optional(),
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
  labelGap: z.number().nonnegative().optional(),
  route: edgeRouteSchema.optional(),
  arcCenter: z.object({ x: z.number(), y: z.number() }).optional(),
  arcRadius: z.number().positive().optional(),
  arcClockwise: z.boolean().optional(),
  routeExtend: z.number().nonnegative().optional(),
  routeOffset: z.number().optional(),
  corner: z.enum(['none', 'round', 'bevel']).optional(),
  cornerRadius: z.number().nonnegative().optional(),
  flow: z.boolean().optional(),
  flowConverse: z.boolean().optional(),
  loopedType: z.enum(['arc', 'rectangle']).optional(),
  loopedDirection: z.enum([
    'north',
    'south',
    'east',
    'west',
    'northeast',
    'northwest',
    'southeast',
    'southwest',
  ]).optional(),
  loopedGap: z.number().nonnegative().optional(),
  bundle: z.boolean().optional(),
  bundleGap: z.number().nonnegative().optional(),
  bundleOffset: z.number().nonnegative().optional(),
  shapeKind: z.enum(['lineto', 'quadto', 'cubicto', 'orthogonalto']).optional(),
  label: graphTextStyleSchema.optional(),
  label2: graphTextStyleSchema.optional(),
  tooltip: graphTextStyleSchema.optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
  arrowFrom: z.boolean().optional(),
  arrowTo: z.boolean().optional(),
  arrow: graphEdgeArrowStyleSchema.optional(),
}).superRefine((style, ctx) => {
  if (style.route === 'arc' && style.arcCenter === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'style.route "arc" requires style.arcCenter',
      path: ['arcCenter'],
    })
  }
})

/** Base edge object (no refinements) so `updateEdge` can `.partial()`. */
const graphEdgeObjectSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.string().optional(),
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  shapePoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  fromAnchor: z
    .enum([
      'top',
      'bottom',
      'left',
      'right',
      'topLeft',
      'topRight',
      'bottomLeft',
      'bottomRight',
      'radial',
    ])
    .optional(),
  toAnchor: z
    .enum([
      'top',
      'bottom',
      'left',
      'right',
      'topLeft',
      'topRight',
      'bottomLeft',
      'bottomRight',
      'radial',
    ])
    .optional(),
  fromOutset: z.number().nonnegative().optional(),
  toOutset: z.number().nonnegative().optional(),
  label: z.string().optional(),
  label2: z.string().optional(),
  tooltip: z.string().optional(),
  alarms: z.array(alarmSchema).optional(),
  style: graphEdgeStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphEdgeSchema = graphEdgeObjectSchema.superRefine((edge, ctx) => {
  if (edge.style?.route === 'shape') {
    if (edge.shapePoints === undefined || edge.shapePoints.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'style.route "shape" requires non-empty shapePoints',
        path: ['shapePoints'],
      })
    }
  }
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
  collapsedLabelPosition: attachmentPositionSchema.optional(),
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

const pathShapeKindSchema = z.enum(['lineto', 'quadto', 'cubicto'])

const graphPathStyleSchema = z.object({
  stroke: z.string().optional(),
  lineWidth: z.number().positive().optional(),
  strokeDash: z.array(z.number()).optional(),
  alpha: z.number().min(0).max(1).optional(),
  shapeKind: pathShapeKindSchema.optional(),
  fill: z.string().optional(),
  label: graphTextStyleSchema.optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
})

/** Base path object (no refinements) so `updatePath` can `.partial()`. */
const graphPathObjectSchema = z.object({
  id: z.string().min(1),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  closed: z.boolean().optional(),
  label: z.string().optional(),
  tooltip: z.string().optional(),
  locked: z.boolean().optional(),
  style: graphPathStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Path point arity vs shapeKind (aligns with freestanding densify of
 * `buildShapeRoute` control points — fail loud on remainder):
 * - lineto (default): ≥2
 * - quadto: odd count ≥3
 * - cubicto: count ≡ 1 (mod 3), ≥4
 */
function refinePathPointsArity(
  points: readonly { x: number; y: number }[],
  shapeKind: 'lineto' | 'quadto' | 'cubicto' | undefined,
  ctx: z.RefinementCtx,
): void {
  const kind = shapeKind ?? 'lineto'
  const n = points.length
  if (kind === 'lineto') {
    if (n < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lineto requires points.length ≥ 2',
        path: ['points'],
      })
    }
    return
  }
  if (kind === 'quadto') {
    if (n < 3 || n % 2 === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'style.shapeKind "quadto" requires an odd points.length ≥ 3',
        path: ['points'],
      })
    }
    return
  }
  if (n < 4 || n % 3 !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'style.shapeKind "cubicto" requires points.length ≡ 1 (mod 3) and ≥ 4',
      path: ['points'],
    })
  }
}

const graphPathSchema = graphPathObjectSchema.superRefine((path, ctx) => {
  refinePathPointsArity(path.points, path.style?.shapeKind, ctx)
})

const graphShapeNodeStyleSchema = z.object({
  stroke: z.string().optional(),
  lineWidth: z.number().positive().optional(),
  strokeDash: z.array(z.number()).optional(),
  fill: z.string().optional(),
  alpha: z.number().min(0).max(1).optional(),
  shapeKind: pathShapeKindSchema.optional(),
  label: graphTextStyleSchema.optional(),
  select: graphChromeStyleSchema.optional(),
  hover: graphChromeStyleSchema.optional(),
})

/** Base shape-node object (no refinements) so `updateShapeNode` can `.partial()`. */
const graphShapeNodeObjectSchema = z.object({
  id: z.string().min(1),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  closed: z.boolean().optional(),
  label: z.string().optional(),
  label2: z.string().optional(),
  tooltip: z.string().optional(),
  locked: z.boolean().optional(),
  groupId: z.string().optional(),
  alarms: z.array(alarmSchema).optional(),
  style: graphShapeNodeStyleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const graphShapeNodeSchema = graphShapeNodeObjectSchema.superRefine((shapeNode, ctx) => {
  refinePathPointsArity(shapeNode.points, shapeNode.style?.shapeKind, ctx)
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
    paths: z.array(graphPathSchema).optional(),
    shapeNodes: z.array(graphShapeNodeSchema).optional(),
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
  z.object({
    op: z.literal('updateEdge'),
    id: z.string().min(1),
    patch: graphEdgeObjectSchema.partial().omit({ id: true }),
  }),
  z.object({ op: z.literal('removeEdge'), id: z.string().min(1) }),
  z.object({ op: z.literal('addGroup'), group: graphGroupSchema }),
  z.object({ op: z.literal('updateGroup'), id: z.string().min(1), patch: graphGroupSchema.partial().omit({ id: true }) }),
  z.object({ op: z.literal('removeGroup'), id: z.string().min(1) }),
  z.object({ op: z.literal('addPath'), path: graphPathSchema }),
  z.object({
    op: z.literal('updatePath'),
    id: z.string().min(1),
    patch: graphPathObjectSchema.partial().omit({ id: true }).superRefine((patch, ctx) => {
      if (patch.points === undefined) return
      refinePathPointsArity(patch.points, patch.style?.shapeKind, ctx)
    }),
  }),
  z.object({ op: z.literal('removePath'), id: z.string().min(1) }),
  z.object({ op: z.literal('addShapeNode'), shapeNode: graphShapeNodeSchema }),
  z.object({
    op: z.literal('updateShapeNode'),
    id: z.string().min(1),
    patch: graphShapeNodeObjectSchema.partial().omit({ id: true }).superRefine((patch, ctx) => {
      if (patch.points === undefined) return
      refinePathPointsArity(patch.points, patch.style?.shapeKind, ctx)
    }),
  }),
  z.object({ op: z.literal('removeShapeNode'), id: z.string().min(1) }),
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

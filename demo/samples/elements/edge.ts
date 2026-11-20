import type { GraphDocument, GraphEdge, GraphNode } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Parameterized Edge gallery: every implemented route + corner / arrow / loop /
 * flow / bundle / shape. Labels name the `style.route` (or feature) under test.
 */

const COL_W = 220
const ROW_H = 110
const NODE_W = 56
const NODE_H = 36

function pair(
  id: string,
  col: number,
  row: number,
  label: string,
  edgeStyle: GraphEdge['style'],
  extra?: Partial<GraphEdge>,
): { nodes: GraphNode[]; edge: GraphEdge } {
  const x0 = 40 + col * COL_W
  const y0 = 40 + row * ROW_H
  const fromId = `${id}-a`
  const toId = `${id}-b`
  return {
    nodes: [
      {
        id: fromId,
        type: 'agent',
        label: 'A',
        x: x0,
        y: y0,
        w: NODE_W,
        h: NODE_H,
      },
      {
        id: toId,
        type: 'agent',
        label: 'B',
        x: x0 + 120,
        y: y0 + (row % 2 === 0 ? 0 : 28),
        w: NODE_W,
        h: NODE_H,
      },
    ],
    edge: {
      id: `e-${id}`,
      from: fromId,
      to: toId,
      label,
      style: { arrowTo: true, ...edgeStyle },
      ...extra,
    },
  }
}

const catalog: Array<ReturnType<typeof pair>> = [
  // Row 0 — orthogonal family
  pair('ortho', 0, 0, 'orthogonal', { route: 'orthogonal' }),
  pair('orthoHV', 1, 0, 'orthogonalHV', { route: 'orthogonalHV' }),
  pair('orthoVH', 2, 0, 'orthogonalVH', { route: 'orthogonalVH' }),
  pair('orthoH', 3, 0, 'orthogonalHorizontal', { route: 'orthogonalHorizontal' }),
  // Row 1
  pair('orthoV', 0, 1, 'orthogonalVertical', { route: 'orthogonalVertical' }),
  pair('flex', 1, 1, 'flexional', { route: 'flexional', routeExtend: 24 }),
  pair('flexH', 2, 1, 'flexionalHorizontal', {
    route: 'flexionalHorizontal',
    routeExtend: 24,
  }),
  pair('flexV', 3, 1, 'flexionalVertical', {
    route: 'flexionalVertical',
    routeExtend: 24,
  }),
  // Row 2 — extend + straight + ring arc
  pair('extTop', 0, 2, 'extendTop', { route: 'extendTop', routeExtend: 28 }),
  pair('extLeft', 1, 2, 'extendLeft', { route: 'extendLeft', routeExtend: 28 }),
  pair('extBot', 2, 2, 'extendBottom', { route: 'extendBottom', routeExtend: 28 }),
  pair('extRight', 3, 2, 'extendRight', { route: 'extendRight', routeExtend: 28 }),
  // Row 3 — chord / bulge / ring
  pair('straight', 0, 3, 'straight', { route: 'straight' }),
  pair('bundleArc', 1, 3, 'bundleArc', {
    route: 'bundleArc',
    routeOffset: 28,
    bundleOffset: 24,
  }),
  pair('triangle', 2, 3, 'triangle', {
    route: 'triangle',
    routeOffset: 28,
    bundleOffset: 24,
  }),
  pair('parallel', 3, 3, 'parallel', {
    route: 'parallel',
    routeOffset: 18,
    bundleOffset: 20,
  }),
]

const ringCenter = { x: 40 + 0 * COL_W + 88, y: 40 + 4 * ROW_H + 40 }
const ringPair = pair('ringArc', 0, 4, 'arc (ring)', {
  route: 'arc',
  arcCenter: ringCenter,
  arcRadius: 70,
  arcClockwise: true,
})
// Place ring nodes on a circle-ish layout
ringPair.nodes[0]!.x = ringCenter.x - 60
ringPair.nodes[0]!.y = ringCenter.y - 50
ringPair.nodes[1]!.x = ringCenter.x + 40
ringPair.nodes[1]!.y = ringCenter.y - 10

const shapePair = pair(
  'shape',
  1,
  4,
  'shape/quadto',
  { route: 'shape', shapeKind: 'quadto' },
  {
    shapePoints: [
      { x: 40 + 1 * COL_W + 70, y: 40 + 4 * ROW_H - 20 },
      { x: 40 + 1 * COL_W + 110, y: 40 + 4 * ROW_H + 50 },
    ],
  },
)

const cornerRound = pair('cornerR', 2, 4, 'corner:round', {
  route: 'orthogonalHV',
  corner: 'round',
  cornerRadius: 14,
})
const cornerBevel = pair('cornerB', 3, 4, 'corner:bevel', {
  route: 'orthogonalHV',
  corner: 'bevel',
  cornerRadius: 14,
})
const cornerNone = pair('cornerN', 0, 5, 'corner:none', {
  route: 'orthogonalHV',
  corner: 'none',
})

const arrowShapes = (['standard', 'delta', 'diamond', 'short', 'slant'] as const).map(
  (shape, i) =>
    pair(`arr-${shape}`, i, 6, `arrow:${shape}`, {
      route: 'straight',
      arrowTo: true,
      arrow: { shape, size: 14 },
    }),
)

const flowPair = pair('flow', 0, 7, 'flow', {
  route: 'orthogonal',
  flow: true,
  strokeDash: [12, 8],
  stroke: '#2563eb',
})

const loopNode: GraphNode = {
  id: 'loop-n',
  type: 'agent',
  label: 'self',
  x: 40 + 1 * COL_W,
  y: 40 + 7 * ROW_H,
  w: NODE_W,
  h: NODE_H,
}
const loopEdge: GraphEdge = {
  id: 'e-loop',
  from: 'loop-n',
  to: 'loop-n',
  label: 'looped',
  style: {
    loopedType: 'arc',
    loopedDirection: 'northwest',
    loopedGap: 8,
    arrowTo: true,
  },
}

const loopRect: GraphNode = {
  id: 'loop-r',
  type: 'agent',
  label: 'rect',
  x: 40 + 2 * COL_W,
  y: 40 + 7 * ROW_H,
  w: NODE_W,
  h: NODE_H,
}
const loopRectEdge: GraphEdge = {
  id: 'e-loop-rect',
  from: 'loop-r',
  to: 'loop-r',
  label: 'looped:rect',
  style: {
    loopedType: 'rectangle',
    loopedDirection: 'east',
    loopedGap: 6,
    arrowTo: true,
  },
}

// Bundle fan: three edges same endpoints
const bundleA: GraphNode = {
  id: 'bun-a',
  type: 'agent',
  label: 'A',
  x: 40 + 3 * COL_W,
  y: 40 + 7 * ROW_H,
  w: NODE_W,
  h: NODE_H,
}
const bundleB: GraphNode = {
  id: 'bun-b',
  type: 'agent',
  label: 'B',
  x: 40 + 3 * COL_W + 120,
  y: 40 + 7 * ROW_H + 20,
  w: NODE_W,
  h: NODE_H,
}
const bundleEdges: GraphEdge[] = [
  {
    id: 'e-bun-0',
    from: 'bun-a',
    to: 'bun-b',
    label: 'bundle×3',
    style: { route: 'bundleArc', bundleGap: 14, bundleOffset: 22, arrowTo: true },
  },
  {
    id: 'e-bun-1',
    from: 'bun-a',
    to: 'bun-b',
    style: { route: 'bundleArc', bundleGap: 14, bundleOffset: 22, arrowTo: true },
  },
  {
    id: 'e-bun-2',
    from: 'bun-a',
    to: 'bun-b',
    style: { route: 'bundleArc', bundleGap: 14, bundleOffset: 22, arrowTo: true },
  },
]

// Group section (behavior, not route catalog) — keep ids a/b/out for registry checks.
const groupNodes: GraphNode[] = [
  { id: 'a', type: 'agent', label: 'A', x: 80, y: 40 + 8.5 * ROW_H, groupId: 'band' },
  { id: 'b', type: 'agent', label: 'B', x: 200, y: 40 + 8.5 * ROW_H, groupId: 'band' },
  { id: 'out', type: 'agent', label: 'Outside', x: 400, y: 40 + 8.5 * ROW_H },
]
const groupEdges: GraphEdge[] = [
  { id: 'e-member', from: 'a', to: 'b', label: 'member' },
  {
    id: 'e-penetrate',
    from: 'a',
    to: 'out',
    label: 'penetrate',
    style: { strokeDash: [6, 3] },
  },
  {
    id: 'e-group',
    from: 'band',
    to: 'out',
    label: 'group→node',
    style: { arrowTo: true },
  },
]

const allPairs = [
  ...catalog,
  ringPair,
  shapePair,
  cornerRound,
  cornerBevel,
  cornerNone,
  ...arrowShapes,
  flowPair,
]

export const edgeDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Edge', kind: 'custom' },
  nodes: [
    ...allPairs.flatMap(p => p.nodes),
    loopNode,
    loopRect,
    bundleA,
    bundleB,
    ...groupNodes,
  ],
  edges: [
    ...allPairs.map(p => p.edge),
    loopEdge,
    loopRectEdge,
    ...bundleEdges,
    ...groupEdges,
  ],
  groups: [
    {
      id: 'band',
      label: 'Band (dblclick)',
      memberIds: ['a', 'b'],
      expanded: true,
      x: 40,
      y: 40 + 8.5 * ROW_H - 40,
      style: {
        labelPosition: 'insideTop',
        paddingTop: 28,
        collapsedLabelPosition: 'bottom',
      },
    },
  ],
}

export const edgeSample: DemoSample = {
  id: 'edge',
  title: 'Edge',
  group: 'elements',
  description:
    'All style.route values + corner / arrow.shape / looped / flow / bundle / shape; Group member·penetrate·group-endpoint (dblclick fold).',
  document: edgeDocument,
}

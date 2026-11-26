import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Elements showcase for freestanding GraphPath (not GraphEdge).
 * Covers lineto / quadto / cubicto, dash, closed fill, lock, and label.
 */
export const pathDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Path', kind: 'custom' },
  nodes: [
    {
      id: 'anchor',
      type: 'unit',
      label: 'Anchor',
      x: 40,
      y: 40,
      w: 56,
      h: 36,
      data: { fill: '#f8fafc', stroke: '#94a3b8' },
      style: { showIcon: false, label: { fontSize: 10 } },
    },
  ],
  edges: [],
  groups: [],
  paths: [
    {
      id: 'lineto-open',
      label: 'lineto',
      points: [
        { x: 120, y: 60 },
        { x: 220, y: 60 },
        { x: 280, y: 120 },
      ],
      style: {
        stroke: '#1d4ed8',
        lineWidth: 2.5,
        shapeKind: 'lineto',
        label: { color: '#1e293b', fontSize: 11, fontWeight: 'bold' },
      },
    },
    {
      id: 'lineto-dash',
      label: 'dashed',
      points: [
        { x: 120, y: 160 },
        { x: 280, y: 160 },
      ],
      style: {
        stroke: '#64748b',
        lineWidth: 2,
        strokeDash: [8, 5],
        shapeKind: 'lineto',
      },
    },
    {
      id: 'quadto-curve',
      label: 'quadto',
      // odd count ≥3: start, control, end
      points: [
        { x: 340, y: 60 },
        { x: 420, y: 20 },
        { x: 500, y: 60 },
        { x: 560, y: 100 },
        { x: 500, y: 140 },
      ],
      style: {
        stroke: '#b45309',
        lineWidth: 2.5,
        shapeKind: 'quadto',
        label: { color: '#92400e', fontSize: 11, fontWeight: 'bold' },
      },
    },
    {
      id: 'cubicto-curve',
      label: 'cubicto',
      // count ≡ 1 mod 3, ≥4: start + (c1,c2,end)*
      points: [
        { x: 120, y: 240 },
        { x: 160, y: 200 },
        { x: 220, y: 280 },
        { x: 280, y: 240 },
        { x: 340, y: 200 },
        { x: 400, y: 280 },
        { x: 460, y: 240 },
      ],
      style: {
        stroke: '#15803d',
        lineWidth: 2.5,
        shapeKind: 'cubicto',
        alpha: 0.95,
        label: { color: '#14532d', fontSize: 11, fontWeight: 'bold' },
      },
    },
    {
      id: 'closed-fill',
      label: 'closed',
      closed: true,
      points: [
        { x: 520, y: 200 },
        { x: 600, y: 200 },
        { x: 600, y: 280 },
        { x: 520, y: 280 },
      ],
      style: {
        stroke: '#6d28d9',
        lineWidth: 2,
        fill: '#ede9fe',
        shapeKind: 'lineto',
        label: { color: '#5b21b6', fontSize: 11, fontWeight: 'bold' },
      },
    },
    {
      id: 'locked-path',
      label: 'locked',
      locked: true,
      points: [
        { x: 120, y: 320 },
        { x: 200, y: 360 },
        { x: 280, y: 320 },
      ],
      style: {
        stroke: '#b91c1c',
        lineWidth: 2,
        strokeDash: [4, 4],
        shapeKind: 'lineto',
      },
      tooltip: 'Locked — body and vertices are not editable',
    },
  ],
}

export const pathSample: DemoSample = {
  id: 'path',
  title: 'Path',
  group: 'elements',
  description:
    'Freestanding GraphPath: lineto / quadto / cubicto, dash, closed fill, lock (not an edge).',
  document: pathDocument,
}

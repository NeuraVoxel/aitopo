import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Elements showcase for GraphShapeNode (polygon / polyline body, not GraphPath).
 * Covers open polyline, closed fill (omitted closed ≡ true), quadto / cubicto,
 * lock, and group membership.
 */
export const shapeNodeDocument: GraphDocument = {
  version: 1,
  meta: { title: 'ShapeNode', kind: 'custom' },
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
  groups: [
    {
      id: 'band',
      label: 'Shape band',
      memberIds: ['in-group'],
      expanded: true,
      x: 480,
      y: 200,
      style: {
        labelPosition: 'top',
      },
    },
  ],
  shapeNodes: [
    {
      id: 'lineto-open',
      label: 'open',
      closed: false,
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
      id: 'closed-fill',
      label: 'closed',
      // omitted closed ≡ true for ShapeNode
      points: [
        { x: 120, y: 160 },
        { x: 220, y: 160 },
        { x: 170, y: 240 },
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
      id: 'quadto-curve',
      label: 'quadto',
      closed: false,
      // odd count ≥3: start, control, end
      points: [
        { x: 320, y: 60 },
        { x: 400, y: 20 },
        { x: 480, y: 60 },
        { x: 540, y: 100 },
        { x: 480, y: 140 },
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
      closed: false,
      // count ≡ 1 mod 3, ≥4: start + (c1,c2,end)*
      points: [
        { x: 120, y: 280 },
        { x: 160, y: 240 },
        { x: 220, y: 320 },
        { x: 280, y: 280 },
        { x: 340, y: 240 },
        { x: 400, y: 320 },
        { x: 460, y: 280 },
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
      id: 'locked-shape',
      label: 'locked',
      locked: true,
      closed: false,
      points: [
        { x: 320, y: 200 },
        { x: 400, y: 240 },
        { x: 480, y: 200 },
      ],
      style: {
        stroke: '#b91c1c',
        lineWidth: 2,
        strokeDash: [4, 4],
        shapeKind: 'lineto',
      },
      tooltip: 'Locked — body and vertices are not editable',
    },
    {
      id: 'angled-shape',
      label: 'angled',
      angle: 30,
      angleAnchor: { u: 0, v: 1 },
      points: [
        { x: 320, y: 320 },
        { x: 400, y: 320 },
        { x: 360, y: 380 },
      ],
      style: {
        stroke: '#0369a1',
        lineWidth: 2,
        fill: '#e0f2fe',
        shapeKind: 'lineto',
        label: { color: '#0c4a6e', fontSize: 11, fontWeight: 'bold' },
      },
    },
    {
      id: 'in-group',
      label: 'member',
      groupId: 'band',
      points: [
        { x: 500, y: 240 },
        { x: 580, y: 240 },
        { x: 580, y: 300 },
        { x: 500, y: 300 },
      ],
      style: {
        stroke: '#0f766e',
        lineWidth: 2,
        fill: '#ccfbf1',
        shapeKind: 'lineto',
        label: { color: '#115e59', fontSize: 11, fontWeight: 'bold' },
      },
    },
  ],
}

export const shapeNodeSample: DemoSample = {
  id: 'shape-node',
  title: 'ShapeNode',
  group: 'elements',
  description:
    'GraphShapeNode: open / closed fill, quadto / cubicto, lock, angle, group member (not a Path).',
  document: shapeNodeDocument,
}

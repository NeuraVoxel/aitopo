import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Elements showcase for document Layers (twaver Layer ideas).
 * ground (fill) under lanes (linework) under agents (nodes).
 * Locked layer: `ground` is not movable; `hidden` layer is invisible.
 */
export const layerDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Layer', kind: 'custom' },
  layers: [
    { id: 'ground', name: 'Ground', movable: false },
    { id: 'lanes', name: 'Lanes' },
    { id: 'agents', name: 'Agents' },
    { id: 'hidden', name: 'Hidden', visible: false },
  ],
  nodes: [
    {
      id: 'car',
      type: 'unit',
      label: 'Agent',
      label2: 'agents layer',
      x: 200,
      y: 150,
      w: 64,
      h: 40,
      layerId: 'agents',
      data: { fill: '#f8fafc', stroke: '#0f172a' },
      style: {
        showIcon: false,
        label: { fontSize: 11, fontWeight: 'bold' },
        label2: { fontSize: 9, color: '#64748b' },
      },
    },
    {
      id: 'ghost',
      type: 'unit',
      label: 'Hidden',
      x: 320,
      y: 160,
      w: 56,
      h: 36,
      layerId: 'hidden',
      data: { fill: '#fecaca', stroke: '#b91c1c' },
      style: { showIcon: false },
    },
  ],
  edges: [],
  shapeNodes: [
    {
      id: 'pad',
      label: 'Ground fill',
      layerId: 'ground',
      points: [
        { x: 80, y: 80 },
        { x: 420, y: 80 },
        { x: 420, y: 280 },
        { x: 80, y: 280 },
      ],
      closed: true,
      style: {
        fill: '#e2e8f0',
        stroke: '#94a3b8',
        lineWidth: 1.5,
        label: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
      },
      tooltip: 'ground layer — not movable',
    },
  ],
  paths: [
    {
      id: 'cl',
      label: 'Centerline',
      layerId: 'lanes',
      points: [
        { x: 250, y: 90 },
        { x: 250, y: 270 },
      ],
      style: {
        stroke: '#1d4ed8',
        lineWidth: 3,
        label: { color: '#1e3a8a', fontSize: 10, fontWeight: 'bold' },
      },
    },
    {
      id: 'boundary',
      label: 'Boundary',
      layerId: 'lanes',
      points: [
        { x: 120, y: 100 },
        { x: 120, y: 260 },
      ],
      style: {
        stroke: '#0f172a',
        lineWidth: 2,
        strokeDash: [8, 5],
      },
    },
  ],
}

export const layerSample: DemoSample = {
  id: 'layer',
  title: 'Layer',
  group: 'elements',
  description:
    'Document layers: ground fill under lane linework under agents; ground not movable; hidden layer invisible.',
  document: layerDocument,
}

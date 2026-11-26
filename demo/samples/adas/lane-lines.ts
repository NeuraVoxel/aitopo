import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Freestanding lane markings as open GraphPath lineto strokes (solid vs dashed).
 */
export const adasLaneLinesDocument: GraphDocument = {
  version: 1,
  meta: { title: 'ADAS lane lines', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 254,
      y: 280,
      w: 72,
      h: 48,
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
      status: 'active',
    }),
  ],
  edges: [],
  groups: [],
  paths: [
    {
      id: 'lane-left',
      label: 'Left solid',
      points: [
        { x: 160, y: 420 },
        { x: 160, y: 280 },
        { x: 160, y: 80 },
      ],
      style: {
        stroke: '#334155',
        lineWidth: 3,
        shapeKind: 'lineto',
      },
    },
    {
      id: 'lane-center',
      label: 'Center dashed',
      points: [
        { x: 290, y: 420 },
        { x: 290, y: 280 },
        { x: 290, y: 80 },
      ],
      style: {
        stroke: '#f59e0b',
        lineWidth: 2,
        strokeDash: [12, 10],
        shapeKind: 'lineto',
      },
    },
    {
      id: 'lane-right',
      label: 'Right solid',
      points: [
        { x: 420, y: 420 },
        { x: 420, y: 280 },
        { x: 420, y: 80 },
      ],
      style: {
        stroke: '#334155',
        lineWidth: 3,
        shapeKind: 'lineto',
      },
    },
  ],
}

export const adasLaneLinesSample: DemoSample = {
  id: 'adas-lane-lines',
  title: 'Lane lines',
  group: 'adas',
  description:
    'Open GraphPath lane markings: solid left/right, dashed center (strokeDash).',
  document: adasLaneLinesDocument,
}

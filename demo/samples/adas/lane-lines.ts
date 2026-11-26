import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_MAP, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Freestanding lane markings as open GraphPath lineto strokes (solid vs dashed).
 */
export function buildAdasLaneLinesDocument(): GraphDocument {
  return {
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
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
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
        stroke: ADAS_MAP.baseline,
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
        stroke: ADAS_TRAJECTORY.expert,
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
        stroke: ADAS_MAP.baseline,
        lineWidth: 3,
        shapeKind: 'lineto',
      },
    },
  ],
  }
}

export const adasLaneLinesSample: DemoSample = {
  id: 'adas-lane-lines',
  title: 'Lane lines',
  group: 'adas',
  description:
    'Open GraphPath lane markings: solid left/right, dashed center (strokeDash).',
  get document() {
    return buildAdasLaneLinesDocument()
  },
}

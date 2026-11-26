import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_MAP } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Left / right road-edge curb polylines as freestanding GraphPath.
 */
export function buildAdasRoadBoundaryDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS road boundary', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 254,
      y: 240,
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
      id: 'boundary-left',
      label: 'Left curb',
      points: [
        { x: 120, y: 420 },
        { x: 130, y: 300 },
        { x: 125, y: 180 },
        { x: 140, y: 60 },
      ],
      style: {
        stroke: ADAS_MAP.walkway.stroke,
        lineWidth: 4,
        shapeKind: 'lineto',
      },
      data: { side: 'left' },
    },
    {
      id: 'boundary-right',
      label: 'Right curb',
      points: [
        { x: 460, y: 420 },
        { x: 450, y: 300 },
        { x: 455, y: 180 },
        { x: 440, y: 60 },
      ],
      style: {
        stroke: ADAS_MAP.walkway.stroke,
        lineWidth: 4,
        shapeKind: 'lineto',
      },
      data: { side: 'right' },
    },
  ],
  }
}

export const adasRoadBoundarySample: DemoSample = {
  id: 'adas-road-boundary',
  title: 'Road boundary',
  group: 'adas',
  description: 'Left and right road-edge GraphPath curb polylines.',
  get document() {
    return buildAdasRoadBoundaryDocument()
  },
}

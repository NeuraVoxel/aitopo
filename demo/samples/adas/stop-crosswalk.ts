import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_MAP } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Rectangular stand-ins: thin GraphNode = stop line, GraphGroup band = crosswalk.
 * Not freestanding path geometry — AABB chrome only.
 */
export function buildAdasStopCrosswalkDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS stop & crosswalk', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'stop-line',
      type: 'marking',
      label: 'STOP',
      x: 120,
      y: 200,
      w: 280,
      h: 14,
      fill: ADAS_MAP.stopLine.fill,
      stroke: ADAS_MAP.stopLine.stroke,
      tooltip: 'Stop line (AABB stand-in)',
    }),
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 224,
      y: 280,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      status: 'active',
    }),
    adasBox({
      id: 'ped',
      type: 'pedestrian',
      label: 'Ped',
      x: 240,
      y: 100,
      w: 36,
      h: 36,
      fill: ADAS_AGENT.pedestrian.fill,
      stroke: ADAS_AGENT.pedestrian.stroke,
      groupId: 'crosswalk',
    }),
  ],
  edges: [],
  groups: [
    {
      id: 'crosswalk',
      label: 'Crosswalk',
      memberIds: ['ped'],
      expanded: true,
      x: 120,
      y: 60,
      w: 280,
      h: 120,
      style: {
        fill: ADAS_MAP.crosswalk.fill,
        stroke: ADAS_MAP.crosswalk.stroke,
        strokeDash: [8, 6],
        autoFit: false,
        labelPosition: 'insideTop',
        paddingTop: 20,
        showIcon: false,
      },
    },
  ],
  }
}

export const adasStopCrosswalkSample: DemoSample = {
  id: 'adas-stop-crosswalk',
  title: 'Stop & crosswalk',
  group: 'adas',
  description:
    'Stop line as thin GraphNode + crosswalk as GraphGroup AABB (not path polygons).',
  get document() {
    return buildAdasStopCrosswalkDocument()
  },
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import {
  ADAS_AGENT,
  ADAS_MAP,
  ADAS_BRAND,
} from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Drivable corridor approximated as an expanded GraphGroup fill.
 * True free-space polygons are not an engine primitive.
 */
export function buildAdasDrivableAreaDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS drivable area', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 244,
      y: 220,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      status: 'active',
      groupId: 'drivable',
    }),
    adasBox({
      id: 'lead',
      type: 'vehicle',
      label: 'Lead',
      x: 244,
      y: 80,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      groupId: 'drivable',
    }),
    adasBox({
      id: 'parked',
      type: 'vehicle',
      label: 'Parked',
      x: 460,
      y: 180,
      w: 72,
      h: 48,
      fill: ADAS_BRAND.lightAsphalt,
      stroke: ADAS_BRAND.mediumAsphalt,
      tooltip: 'Outside drivable band',
    }),
  ],
  edges: [],
  groups: [
    {
      id: 'drivable',
      label: 'Drivable',
      label2: 'AABB stand-in',
      memberIds: ['ego', 'lead'],
      expanded: true,
      x: 160,
      y: 40,
      w: 240,
      h: 320,
      style: {
        fill: ADAS_MAP.lane.fill,
        stroke: ADAS_MAP.lane.stroke,
        strokeWidth: 2,
        autoFit: false,
        labelPosition: 'insideTop',
        label2Position: 'insideBottom',
        paddingTop: 28,
        showIcon: false,
        alpha: 0.95,
      },
    },
  ],
  }
}

export const adasDrivableAreaSample: DemoSample = {
  id: 'adas-drivable-area',
  title: 'Drivable area',
  group: 'adas',
  description:
    'Free-space as GraphGroup rectangle fill (not a true polygon mesh; nuBoard lane chrome).',
  get document() {
    return buildAdasDrivableAreaDocument()
  },
}

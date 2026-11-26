import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Ego planned trajectory ahead as one freestanding cubicto GraphPath.
 * Point count 7 ≡ 1 (mod 3), ≥ 4. Stroke uses nuBoard ego trajectory cyan.
 */
export function buildAdasPlanningPathDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS planning path', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 254,
      y: 340,
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
      id: 'plan',
      label: 'Plan',
      tooltip: 'Ego planned trajectory (cubicto)',
      // start + (c1,c2,end) + (c1,c2,end) → 7 points
      points: [
        { x: 290, y: 340 },
        { x: 290, y: 280 },
        { x: 310, y: 220 },
        { x: 340, y: 180 },
        { x: 380, y: 140 },
        { x: 400, y: 90 },
        { x: 410, y: 40 },
      ],
      style: {
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 3,
        shapeKind: 'cubicto',
      },
      data: { role: 'planning' },
    },
  ],
  }
}

export const adasPlanningPathSample: DemoSample = {
  id: 'adas-planning-path',
  title: 'Planning path',
  group: 'adas',
  description: 'Ego vehicle with one cubicto GraphPath planned trajectory ahead.',
  get document() {
    return buildAdasPlanningPathDocument()
  },
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_AGENT } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/** BEV detection boxes as axis-aligned GraphNode rectangles (nuPlan agent colors). */
export function buildAdasPerceptionBoxesDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS perception boxes', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 260,
      y: 220,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      status: 'active',
    }),
    adasBox({
      id: 'car-1',
      type: 'vehicle',
      label: 'Car',
      label2: '0.94',
      x: 260,
      y: 60,
      w: 80,
      h: 44,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      data: { class: 'car', score: 0.94 },
    }),
    adasBox({
      id: 'truck-1',
      type: 'vehicle',
      label: 'Truck',
      label2: '0.88',
      x: 80,
      y: 140,
      w: 110,
      h: 56,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      data: { class: 'truck', score: 0.88 },
    }),
    adasBox({
      id: 'bike-1',
      type: 'vehicle',
      label: 'Bike',
      label2: '0.81',
      x: 440,
      y: 180,
      w: 40,
      h: 70,
      fill: ADAS_AGENT.bicycle.fill,
      stroke: ADAS_AGENT.bicycle.stroke,
      data: { class: 'bike', score: 0.81 },
    }),
    adasBox({
      id: 'car-2',
      type: 'vehicle',
      label: 'Car',
      label2: '0.76',
      x: 420,
      y: 320,
      w: 76,
      h: 44,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      data: { class: 'car', score: 0.76 },
    }),
  ],
  edges: [],
  groups: [],
  }
}

export const adasPerceptionBoxesSample: DemoSample = {
  id: 'adas-perception-boxes',
  title: 'Perception boxes',
  group: 'adas',
  description: 'BEV detection boxes as GraphNode AABBs (car / truck / bike + ego).',
  get document() {
    return buildAdasPerceptionBoxesDocument()
  },
}

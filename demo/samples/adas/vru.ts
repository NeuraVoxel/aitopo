import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/** Vulnerable road users beside ego — GraphNode agents on BEV. */
export const adasVruDocument: GraphDocument = {
  version: 1,
  meta: { title: 'ADAS VRU', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 240,
      y: 200,
      w: 72,
      h: 48,
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
      status: 'active',
    }),
    adasBox({
      id: 'ped-1',
      type: 'pedestrian',
      label: 'Ped',
      label2: 'crosswalk',
      x: 120,
      y: 80,
      w: 36,
      h: 36,
      fill: '#fce7f3',
      stroke: '#be185d',
      tooltip: 'Pedestrian intent: cross',
    }),
    adasBox({
      id: 'ped-2',
      type: 'pedestrian',
      label: 'Ped',
      label2: 'sidewalk',
      x: 400,
      y: 100,
      w: 36,
      h: 36,
      fill: '#fce7f3',
      stroke: '#be185d',
    }),
    adasBox({
      id: 'cyclist-1',
      type: 'cyclist',
      label: 'Bike',
      label2: 'VRU',
      x: 380,
      y: 260,
      w: 44,
      h: 64,
      fill: '#dcfce7',
      stroke: '#15803d',
    }),
    adasBox({
      id: 'scooter-1',
      type: 'cyclist',
      label: 'Scooter',
      x: 100,
      y: 280,
      w: 40,
      h: 56,
      fill: '#ccfbf1',
      stroke: '#0f766e',
    }),
  ],
  edges: [
    {
      id: 'attn-ped',
      from: 'ego',
      to: 'ped-1',
      kind: 'attention',
      label: 'yield',
      style: {
        route: 'straight',
        strokeDash: [5, 4],
        arrowTo: true,
        labelSide: 'aboveOrRight',
      },
    },
    {
      id: 'attn-bike',
      from: 'ego',
      to: 'cyclist-1',
      kind: 'attention',
      label: 'track',
      style: {
        route: 'straight',
        strokeDash: [5, 4],
        arrowTo: true,
        labelSide: 'aboveOrRight',
      },
    },
  ],
  groups: [],
}

export const adasVruSample: DemoSample = {
  id: 'adas-vru',
  title: 'VRU / pedestrian',
  group: 'adas',
  description: 'Pedestrians and cyclists as GraphNode agents with ego attention edges.',
  document: adasVruDocument,
}

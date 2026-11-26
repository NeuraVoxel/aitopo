import type { GraphDocument } from '../../../src/protocol/types.ts'
import {
  ADAS_AGENT,
  ADAS_MAP,
  ADAS_OCCUPANCY,
} from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Axis-aligned parking slots (engine has no rotate handles).
 * Occupied slots hold a vehicle member; free slots are empty groups.
 * Chrome: nuBoard carpark / occupancy / vehicle.
 */
export function buildAdasParkingSlotsDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS parking slots', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'car-a',
      type: 'vehicle',
      label: 'Car',
      x: 92,
      y: 118,
      w: 56,
      h: 36,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      groupId: 'slot-1',
    }),
    adasBox({
      id: 'car-b',
      type: 'vehicle',
      label: 'Car',
      x: 292,
      y: 118,
      w: 56,
      h: 36,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      groupId: 'slot-3',
    }),
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 190,
      y: 280,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      status: 'active',
    }),
  ],
  edges: [],
  groups: [
    {
      id: 'slot-1',
      label: 'P1',
      label2: 'occupied',
      memberIds: ['car-a'],
      expanded: true,
      x: 60,
      y: 60,
      w: 120,
      h: 160,
      data: {
        fill: ADAS_OCCUPANCY.occupied.fill,
        stroke: ADAS_OCCUPANCY.occupied.stroke,
      },
      style: {
        fill: ADAS_OCCUPANCY.occupied.fill,
        stroke: ADAS_OCCUPANCY.occupied.stroke,
        autoFit: false,
        labelPosition: 'insideTop',
        label2Position: 'insideBottom',
        paddingTop: 28,
        showIcon: false,
      },
    },
    {
      id: 'slot-2',
      label: 'P2',
      label2: 'free',
      memberIds: [],
      expanded: true,
      x: 200,
      y: 60,
      w: 120,
      h: 160,
      style: {
        fill: ADAS_MAP.carpark.fill,
        stroke: ADAS_MAP.carpark.stroke,
        autoFit: false,
        labelPosition: 'insideTop',
        label2Position: 'insideBottom',
        paddingTop: 28,
        showIcon: false,
      },
    },
    {
      id: 'slot-3',
      label: 'P3',
      label2: 'occupied',
      memberIds: ['car-b'],
      expanded: true,
      x: 340,
      y: 60,
      w: 120,
      h: 160,
      style: {
        fill: ADAS_OCCUPANCY.occupied.fill,
        stroke: ADAS_OCCUPANCY.occupied.stroke,
        autoFit: false,
        labelPosition: 'insideTop',
        label2Position: 'insideBottom',
        paddingTop: 28,
        showIcon: false,
      },
    },
    {
      id: 'slot-4',
      label: 'P4',
      label2: 'free',
      memberIds: [],
      expanded: true,
      x: 480,
      y: 60,
      w: 120,
      h: 160,
      style: {
        fill: ADAS_MAP.carpark.fill,
        stroke: ADAS_MAP.carpark.stroke,
        autoFit: false,
        labelPosition: 'insideTop',
        label2Position: 'insideBottom',
        paddingTop: 28,
        showIcon: false,
      },
    },
  ],
  }
}

export const adasParkingSlotsSample: DemoSample = {
  id: 'adas-parking-slots',
  title: 'Parking slots',
  group: 'adas',
  description:
    'Axis-aligned parking bays as GraphGroup (no rotate); occupied vs free chrome (nuBoard).',
  get document() {
    return buildAdasParkingSlotsDocument()
  },
}

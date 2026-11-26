import type { GraphDocument } from '../../../src/protocol/types.ts'
import {
  ADAS_AGENT,
  ADAS_MAP,
  ADAS_SIGNAL,
} from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/** Traffic lights and roadside signs with status / alarm chrome (nuBoard). */
export function buildAdasTrafficSignalsDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS traffic signals', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 260,
      y: 280,
      w: 72,
      h: 48,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      status: 'active',
    }),
    adasBox({
      id: 'tl-green',
      type: 'signal',
      label: 'TL',
      label2: 'green',
      x: 260,
      y: 60,
      w: 56,
      h: 72,
      fill: ADAS_SIGNAL.green.fill,
      stroke: ADAS_SIGNAL.green.stroke,
      status: 'active',
      tooltip: 'Signal phase: green',
      data: { phase: 'green' },
    }),
    adasBox({
      id: 'tl-amber',
      type: 'signal',
      label: 'TL',
      label2: 'amber',
      x: 100,
      y: 120,
      w: 56,
      h: 72,
      fill: ADAS_SIGNAL.amber.fill,
      stroke: ADAS_SIGNAL.amber.stroke,
      status: 'running',
      alarms: [{ id: 'a-amber', level: 'warn', message: 'Phase ending' }],
      data: { phase: 'amber' },
    }),
    adasBox({
      id: 'tl-red',
      type: 'signal',
      label: 'TL',
      label2: 'red',
      x: 420,
      y: 120,
      w: 56,
      h: 72,
      fill: ADAS_SIGNAL.red.fill,
      stroke: ADAS_SIGNAL.red.stroke,
      status: 'idle',
      alarms: [{ id: 'a-red', level: 'error', message: 'Stop required' }],
      data: { phase: 'red' },
    }),
    adasBox({
      id: 'sign-stop',
      type: 'sign',
      label: 'STOP',
      x: 100,
      y: 280,
      w: 64,
      h: 64,
      fill: ADAS_MAP.stopLine.fill,
      stroke: ADAS_MAP.stopLine.stroke,
      tooltip: 'Regulatory stop sign',
    }),
    adasBox({
      id: 'sign-speed',
      type: 'sign',
      label: '60',
      label2: 'km/h',
      x: 420,
      y: 280,
      w: 64,
      h: 64,
      fill: ADAS_AGENT.ego.fill,
      stroke: ADAS_AGENT.ego.stroke,
      tooltip: 'Speed limit 60',
    }),
  ],
  edges: [
    {
      id: 'see-green',
      from: 'ego',
      to: 'tl-green',
      kind: 'perception',
      label: 'primary',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
  ],
  groups: [],
  }
}

export const adasTrafficSignalsSample: DemoSample = {
  id: 'adas-traffic-signals',
  title: 'Traffic signals',
  group: 'adas',
  description: 'Traffic lights and signs as GraphNode chrome with status and alarms (nuBoard).',
  get document() {
    return buildAdasTrafficSignalsDocument()
  },
}

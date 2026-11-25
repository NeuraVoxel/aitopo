import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

const VEHICLE_W = 72
const VEHICLE_H = 48

function vehicle(opts: {
  readonly id: string
  readonly label: string
  readonly label2?: string
  readonly x: number
  readonly y: number
  readonly fill: string
  readonly stroke: string
  readonly status?: GraphNode['status']
}): GraphNode {
  return {
    id: opts.id,
    type: 'vehicle',
    label: opts.label,
    ...(opts.label2 !== undefined ? { label2: opts.label2 } : {}),
    ...(opts.status !== undefined ? { status: opts.status } : {}),
    x: opts.x,
    y: opts.y,
    w: VEHICLE_W,
    h: VEHICLE_H,
    data: { fill: opts.fill, stroke: opts.stroke, role: opts.id },
    style: {
      labelPosition: 'center',
      label: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 },
      ...(opts.label2 !== undefined
        ? { label2Position: 'bottom' as const, label2: { color: '#64748b', fontSize: 10 } }
        : {}),
      showIcon: false,
    },
  }
}

/**
 * Bird's-eye ego + surrounding traffic using existing GraphNode only.
 * Lane / boundary geometry stays reserved until freestanding paths exist.
 */
export const adasEgoSurroundDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'ADAS ego + surround',
    kind: 'custom',
    domain: 'adas',
  },
  nodes: [
    vehicle({
      id: 'ego',
      label: 'Ego',
      label2: 'host',
      x: 260,
      y: 200,
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
      status: 'active',
    }),
    vehicle({
      id: 'lead',
      label: 'Lead',
      label2: 'front',
      x: 260,
      y: 60,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    vehicle({
      id: 'rear',
      label: 'Rear',
      label2: 'behind',
      x: 260,
      y: 340,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    vehicle({
      id: 'left',
      label: 'Left',
      label2: 'adjacent',
      x: 100,
      y: 200,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    vehicle({
      id: 'right',
      label: 'Right',
      label2: 'adjacent',
      x: 420,
      y: 200,
      fill: '#ffffff',
      stroke: '#334155',
    }),
  ],
  edges: [
    {
      id: 'rel-lead',
      from: 'ego',
      to: 'lead',
      kind: 'relative',
      label: 'front',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
    {
      id: 'rel-rear',
      from: 'ego',
      to: 'rear',
      kind: 'relative',
      label: 'rear',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
    {
      id: 'rel-left',
      from: 'ego',
      to: 'left',
      kind: 'relative',
      label: 'left',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
    {
      id: 'rel-right',
      from: 'ego',
      to: 'right',
      kind: 'relative',
      label: 'right',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
  ],
  groups: [],
}

export const adasEgoSurroundSample: DemoSample = {
  id: 'adas-ego-surround',
  title: 'Ego + surround',
  group: 'adas',
  description: 'Bird\'s-eye ego vehicle and four surrounding traffic objects (GraphNode only).',
  document: adasEgoSurroundDocument,
}

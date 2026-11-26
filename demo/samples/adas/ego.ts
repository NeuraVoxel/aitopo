import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import {
  DEMO_EGO_CAR_BITMAP_IMAGE,
  DEMO_EGO_CAR_VECTOR_IMAGE,
  DEMO_HEADING_VECTOR_IMAGE,
} from '../../lib/vector-images.ts'
import type { DemoSample } from '../types.ts'

/** Rear-axle relative pivot (local origin for heading). */
const REAR_AXLE = { u: 0.5, v: 0.82 } as const

const EGO_W = 40
const EGO_H = 80
const ROW_Y = 200
/** Horizontal centers for six sequential ego styles. */
const XS = [90, 230, 370, 510, 650, 790] as const

function egoBase(
  id: string,
  x: number,
  label2: string,
  extras: Partial<GraphNode> & { data?: GraphNode['data']; style?: GraphNode['style'] },
): GraphNode {
  return {
    id,
    type: 'vehicle',
    label: 'Ego',
    label2,
    status: 'active',
    x,
    y: ROW_Y,
    w: EGO_W,
    h: EGO_H,
    ...extras,
    data: {
      role: 'ego',
      ...extras.data,
    },
    style: {
      showIcon: false,
      labelPosition: 'center',
      label: { color: '#0f172a', fontWeight: 'bold', fontSize: 10 },
      label2Position: 'bottom',
      label2: { color: '#64748b', fontSize: 9 },
      ...extras.style,
    },
  }
}

/**
 * Six ego styles left→right: base heading → +30° → longer arrow → phase
 * pulse → vector car + border → bitmap car + border.
 */
export const adasEgoDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'ADAS ego',
    kind: 'custom',
    domain: 'adas',
  },
  nodes: [
    egoBase('ego-base', XS[0], '1 · base', {
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#bfdbfe',
        stroke: '#1d4ed8',
        axle: 'rear',
        speedMs: 10,
      },
    }),
    egoBase('ego-angle', XS[1], '2 · angle 30°', {
      angle: 30,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#bfdbfe',
        stroke: '#1d4ed8',
        axle: 'rear',
        speedMs: 10,
      },
    }),
    egoBase('ego-length', XS[2], '3 · arrow len', {
      angle: 30,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#dbeafe',
        stroke: '#1e40af',
        axle: 'rear',
        speedMs: 22,
      },
    }),
    egoBase('ego-animate', XS[3], '4 · animate', {
      angle: 15,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#bfdbfe',
        stroke: '#1d4ed8',
        axle: 'rear',
        speedMs: 12.5,
        vectorImagePhase: 0,
      },
    }),
    egoBase('ego-vector-car', XS[4], '5 · vector', {
      data: {
        fill: 'rgba(0,0,0,0)',
        stroke: '#1d4ed8',
      },
      vectorImage: DEMO_EGO_CAR_VECTOR_IMAGE,
    }),
    egoBase('ego-bitmap', XS[5], '6 · bitmap', {
      data: {
        fill: 'rgba(0,0,0,0)',
        stroke: '#0f172a',
      },
      vectorImage: DEMO_EGO_CAR_BITMAP_IMAGE,
    }),
  ],
  edges: [],
  groups: [],
}

export const adasEgoSample: DemoSample = {
  id: 'adas-ego',
  title: 'Ego',
  group: 'adas',
  description:
    'Six ego styles in order: rect+heading, +30°, longer arrow, phase pulse, vector car+border, bitmap car+border.',
  document: adasEgoDocument,
}

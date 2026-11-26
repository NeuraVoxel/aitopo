import type { GraphDocument } from '../../../src/protocol/types.ts'
import { DEMO_HEADING_VECTOR_IMAGE } from '../../lib/vector-images.ts'
import type { DemoSample } from '../types.ts'

/** Rear-axle relative pivot (local origin for heading). */
const REAR_AXLE = { u: 0.5, v: 0.82 } as const

/**
 * Bird's-eye ego vehicles only: rear-axle angleAnchor + vectorImage heading overlay.
 * `heading` pulses phase; `heading-boost` shows vectorImageState binding.
 */
export const adasEgoDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'ADAS ego',
    kind: 'custom',
    domain: 'adas',
  },
  nodes: [
    {
      id: 'heading',
      type: 'vehicle',
      label: 'Ego',
      label2: 'heading',
      status: 'active',
      x: 160,
      y: 180,
      w: 40,
      h: 80,
      angle: 30,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#bfdbfe',
        stroke: '#1d4ed8',
        role: 'ego',
        axle: 'rear',
        speedMs: 12.5,
        vectorImagePhase: 0,
      },
      style: {
        showIcon: false,
        labelPosition: 'center',
        label: { color: '#0f172a', fontWeight: 'bold', fontSize: 10 },
        label2Position: 'bottom',
        label2: { color: '#64748b', fontSize: 9 },
      },
    },
    {
      id: 'heading-boost',
      type: 'vehicle',
      label: 'Ego',
      label2: 'boost',
      status: 'active',
      x: 320,
      y: 180,
      w: 40,
      h: 80,
      angle: 15,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: '#fee2e2',
        stroke: '#b91c1c',
        role: 'ego-boost',
        axle: 'rear',
        speedMs: 18,
        vectorImagePhase: 0.25,
      },
      style: {
        showIcon: false,
        vectorImageState: 'boost',
        labelPosition: 'center',
        label: { color: '#0f172a', fontWeight: 'bold', fontSize: 10 },
        label2Position: 'bottom',
        label2: { color: '#64748b', fontSize: 9 },
      },
    },
  ],
  edges: [],
  groups: [],
}

export const adasEgoSample: DemoSample = {
  id: 'adas-ego',
  title: 'Ego',
  group: 'adas',
  description:
    'Ego rectangles only: rear-axle angleAnchor with vectorImage heading (phase pulse) and boost state.',
  document: adasEgoDocument,
}

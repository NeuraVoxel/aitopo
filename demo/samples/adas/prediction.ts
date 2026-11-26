import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Multi-modal predicted trajectories from a surround agent (alpha / dash variants).
 */
export const adasPredictionDocument: GraphDocument = {
  version: 1,
  meta: { title: 'ADAS prediction', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: 140,
      y: 260,
      w: 72,
      h: 48,
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
      status: 'active',
    }),
    adasBox({
      id: 'agent',
      type: 'vehicle',
      label: 'Agent',
      label2: 'surround',
      x: 300,
      y: 320,
      w: 72,
      h: 48,
      fill: '#fecaca',
      stroke: '#b91c1c',
    }),
  ],
  edges: [],
  groups: [],
  paths: [
    {
      id: 'pred-go',
      label: 'Go',
      points: [
        { x: 336, y: 320 },
        { x: 350, y: 240 },
        { x: 360, y: 160 },
        { x: 365, y: 60 },
      ],
      style: {
        stroke: '#dc2626',
        lineWidth: 2,
        alpha: 0.9,
        shapeKind: 'lineto',
      },
      data: { mode: 'go', confidence: 0.6 },
    },
    {
      id: 'pred-yield',
      label: 'Yield',
      points: [
        { x: 336, y: 320 },
        { x: 300, y: 250 },
        { x: 260, y: 200 },
        { x: 220, y: 160 },
      ],
      style: {
        stroke: '#ea580c',
        lineWidth: 2,
        alpha: 0.55,
        strokeDash: [10, 8],
        shapeKind: 'lineto',
      },
      data: { mode: 'yield', confidence: 0.25 },
    },
    {
      id: 'pred-cutin',
      label: 'Cut-in',
      // quadto: odd ≥ 3 — start + control + end + control + end = 5
      points: [
        { x: 336, y: 320 },
        { x: 400, y: 280 },
        { x: 440, y: 220 },
        { x: 460, y: 140 },
        { x: 450, y: 60 },
      ],
      style: {
        stroke: '#9333ea',
        lineWidth: 2,
        alpha: 0.35,
        strokeDash: [4, 6],
        shapeKind: 'quadto',
      },
      data: { mode: 'cut-in', confidence: 0.15 },
    },
  ],
}

export const adasPredictionSample: DemoSample = {
  id: 'adas-prediction',
  title: 'Prediction',
  group: 'adas',
  description:
    'Multi-modal prediction GraphPaths from a surround agent (alpha / dash).',
  document: adasPredictionDocument,
}

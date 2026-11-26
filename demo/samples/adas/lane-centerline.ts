import type { GraphDocument } from '../../../src/protocol/types.ts'
import { ADAS_MAP } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

/**
 * Lane centerlines as GraphPath + optional successor edges between lane nodes.
 */
export function buildAdasLaneCenterlineDocument(): GraphDocument {
  return {
  version: 1,
  meta: { title: 'ADAS lane centerline', kind: 'custom', domain: 'adas' },
  nodes: [
    adasBox({
      id: 'lane-a',
      type: 'lane',
      label: 'A',
      label2: 'entry',
      x: 240,
      y: 360,
      w: 56,
      h: 36,
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_MAP.lane.stroke,
    }),
    adasBox({
      id: 'lane-b',
      type: 'lane',
      label: 'B',
      label2: 'mid',
      x: 240,
      y: 200,
      w: 56,
      h: 36,
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_MAP.lane.stroke,
    }),
    adasBox({
      id: 'lane-c',
      type: 'lane',
      label: 'C',
      label2: 'exit',
      x: 240,
      y: 40,
      w: 56,
      h: 36,
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_MAP.lane.stroke,
    }),
  ],
  edges: [
    {
      id: 'succ-ab',
      from: 'lane-a',
      to: 'lane-b',
      kind: 'successor',
      label: 'succ',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
    {
      id: 'succ-bc',
      from: 'lane-b',
      to: 'lane-c',
      kind: 'successor',
      label: 'succ',
      style: { route: 'straight', arrowTo: true, labelSide: 'aboveOrRight' },
    },
  ],
  groups: [],
  paths: [
    {
      id: 'cl-main',
      label: 'Main CL',
      points: [
        { x: 268, y: 400 },
        { x: 268, y: 280 },
        { x: 268, y: 160 },
        { x: 268, y: 20 },
      ],
      style: {
        stroke: ADAS_MAP.baseline,
        lineWidth: 2,
        shapeKind: 'lineto',
      },
    },
    {
      id: 'cl-adjacent',
      label: 'Adjacent CL',
      points: [
        { x: 380, y: 400 },
        { x: 380, y: 280 },
        { x: 380, y: 160 },
        { x: 380, y: 20 },
      ],
      style: {
        stroke: ADAS_MAP.laneConnector,
        lineWidth: 2,
        strokeDash: [8, 6],
        shapeKind: 'lineto',
      },
    },
  ],
  }
}

export const adasLaneCenterlineSample: DemoSample = {
  id: 'adas-lane-centerline',
  title: 'Lane centerline',
  group: 'adas',
  description:
    'Lane centerline GraphPaths with successor edges between lane nodes.',
  get document() {
    return buildAdasLaneCenterlineDocument()
  },
}

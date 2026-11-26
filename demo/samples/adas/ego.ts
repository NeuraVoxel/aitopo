import type { GraphDocument, GraphNode, GraphPath } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_BRAND, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import {
  DEMO_EGO_AXLE_FRAME_IMAGE,
  DEMO_EGO_CAR_BITMAP_IMAGE,
  DEMO_EGO_CAR_VECTOR_IMAGE,
  DEMO_HEADING_VECTOR_IMAGE,
} from '../../lib/vector-images.ts'
import type { DemoSample } from '../types.ts'

/** Rear-axle relative pivot (local origin for heading). */
const REAR_AXLE = { u: 0.5, v: 0.82 } as const

const EGO_W = 40
const EGO_H = 80
const COLS = 4
const ORIGIN_X = 90
const ORIGIN_Y = 160
const COL_GAP = 140
const ROW_GAP = 240

/** Active-theme ego box paint (resolved when the document builds). */
function egoPaint(): { readonly fill: string; readonly stroke: string } {
  return ADAS_AGENT.ego
}

function egoSlot(index: number): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: ORIGIN_X + col * COL_GAP, y: ORIGIN_Y + row * ROW_GAP }
}

function egoBase(
  id: string,
  index: number,
  label2: string,
  extras: Partial<GraphNode> & { data?: GraphNode['data']; style?: GraphNode['style'] },
): GraphNode {
  const { x, y } = egoSlot(index)
  return {
    id,
    type: 'vehicle',
    label: 'Ego',
    label2,
    status: 'active',
    x,
    y,
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
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 10 },
      label2Position: 'bottom',
      label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
      ...extras.style,
    },
  }
}

/** Cubicto plan ahead of `ego-plan` (follows that node on drag). */
function planningPathFor(host: GraphNode): GraphPath {
  const cx = (host.x ?? 0) + (host.w ?? EGO_W) / 2
  const cy = (host.y ?? 0) + (host.h ?? EGO_H) / 2
  return {
    id: 'ego-plan-path',
    label: 'Plan',
    tooltip: 'Ego planned trajectory (cubicto); follows ego-plan',
    followHostId: host.id,
    // start + (c1,c2,end) + (c1,c2,end) → 7 points, heading −Y
    points: [
      { x: cx, y: cy },
      { x: cx, y: cy - 60 },
      { x: cx + 20, y: cy - 120 },
      { x: cx + 50, y: cy - 160 },
      { x: cx + 90, y: cy - 200 },
      { x: cx + 110, y: cy - 250 },
      { x: cx + 120, y: cy - 300 },
    ],
    style: {
      stroke: ADAS_TRAJECTORY.ego,
      lineWidth: 3,
      shapeKind: 'cubicto',
    },
    data: { role: 'planning', hostId: host.id },
  }
}

/**
 * Eight ego styles in row-major order (4 per row): base → +30° → longer
 * arrow → phase pulse → vector/bitmap car → rear-axle frame → plan+follow path.
 * Colors follow nuPlan / nuBoard agent + trajectory palette.
 */
export function buildAdasEgoDocument(): GraphDocument {
  const planEgo = egoBase('ego-plan', 7, '8 · plan path', {
    angleAnchor: { ...REAR_AXLE },
    vectorImage: DEMO_EGO_AXLE_FRAME_IMAGE,
    data: {
      fill: egoPaint().fill,
      stroke: egoPaint().stroke,
      axle: 'rear',
      speedMs: 14,
    },
  })
  return {
  version: 1,
  meta: {
    title: 'ADAS ego',
    kind: 'custom',
    domain: 'adas',
  },
  nodes: [
    egoBase('ego-base', 0, '1 · base', {
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: egoPaint().fill,
        stroke: egoPaint().stroke,
        axle: 'rear',
        speedMs: 10,
      },
    }),
    egoBase('ego-angle', 1, '2 · angle 30°', {
      angle: 30,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: egoPaint().fill,
        stroke: egoPaint().stroke,
        axle: 'rear',
        speedMs: 10,
      },
    }),
    egoBase('ego-length', 2, '3 · arrow len', {
      angle: 30,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: egoPaint().fill,
        stroke: egoPaint().stroke,
        axle: 'rear',
        speedMs: 22,
      },
    }),
    egoBase('ego-animate', 3, '4 · animate', {
      angle: 15,
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      data: {
        fill: egoPaint().fill,
        stroke: egoPaint().stroke,
        axle: 'rear',
        speedMs: 12.5,
        vectorImagePhase: 0,
      },
    }),
    egoBase('ego-vector-car', 4, '5 · vector', {
      data: {
        fill: 'rgba(0,0,0,0)',
        stroke: egoPaint().stroke,
      },
      vectorImage: DEMO_EGO_CAR_VECTOR_IMAGE,
    }),
    egoBase('ego-bitmap', 5, '6 · bitmap', {
      data: {
        fill: 'rgba(0,0,0,0)',
        stroke: egoPaint().stroke,
      },
      vectorImage: DEMO_EGO_CAR_BITMAP_IMAGE,
    }),
    egoBase('ego-axle-frame', 6, '7 · axle frame', {
      angleAnchor: { ...REAR_AXLE },
      vectorImage: DEMO_EGO_AXLE_FRAME_IMAGE,
      data: {
        fill: egoPaint().fill,
        stroke: egoPaint().stroke,
        axle: 'rear',
        // Longer than axle +x (36px) so the heading tip clears the frame.
        speedMs: 16,
      },
    }),
    planEgo,
  ],
  edges: [],
  groups: [],
  paths: [planningPathFor(planEgo)],
  }
}

export const adasEgoSample: DemoSample = {
  id: 'adas-ego',
  title: 'Ego',
  group: 'adas',
  description:
    'Eight ego styles in a 4-column grid: heading, vector/bitmap car, axle frame, plus plan cubicto Path that followHostIds the plan ego.',
  get document() {
    return buildAdasEgoDocument()
  },
}

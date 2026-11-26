import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import { anglePivot, rotatePointAround } from '../../../src/geom.ts'
import type { DemoSample } from '../types.ts'

/** Ego body: length along local forward (−Y), width across. */
const EGO_W = 40
const EGO_H = 80
/** Surround traffic boxes (unchanged aspect). */
const TRAFFIC_W = 72
const TRAFFIC_H = 48

/** Rear-axle relative pivot (local origin for heading). */
const REAR_AXLE = { u: 0.5, v: 0.82 } as const
const EGO_YAW_DEG = 30
const EGO_SPEED_MS = 12.5
/** Arrow length in world px (demo stand-in for speed scale). */
const HEADING_ARROW_LEN = 110

function traffic(opts: {
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
    w: TRAFFIC_W,
    h: TRAFFIC_H,
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
 * World tip of a heading ray from rear axle along local forward (−Y), after yaw.
 * Canvas y-down; positive angle is clockwise.
 */
function headingTip(
  body: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  anchor: { readonly u: number; readonly v: number },
  yawDeg: number,
  length: number,
): { readonly x: number; readonly y: number } {
  const bounds = { x: body.x, y: body.y, width: body.w, height: body.h }
  const axle = anglePivot(bounds, anchor)
  const localFront = { x: axle.x, y: axle.y - length }
  return rotatePointAround(localFront, axle, yawDeg)
}

const egoBody = { x: 280, y: 180, w: EGO_W, h: EGO_H }
const egoAxle = anglePivot(
  { x: egoBody.x, y: egoBody.y, width: egoBody.w, height: egoBody.h },
  REAR_AXLE,
)
const egoTip = headingTip(egoBody, REAR_AXLE, EGO_YAW_DEG, HEADING_ARROW_LEN)
/** Chevron in local body space (forward = −Y), then rotated about rear axle. */
const HEAD_HALF = 7
const HEAD_BACK = 14
const tipLeft = rotatePointAround(
  { x: egoAxle.x - HEAD_HALF, y: egoAxle.y - HEADING_ARROW_LEN + HEAD_BACK },
  egoAxle,
  EGO_YAW_DEG,
)
const tipRight = rotatePointAround(
  { x: egoAxle.x + HEAD_HALF, y: egoAxle.y - HEADING_ARROW_LEN + HEAD_BACK },
  egoAxle,
  EGO_YAW_DEG,
)

/**
 * Bird's-eye ego + surrounding traffic.
 * Ego is a length×width rectangle with rear-axle angleAnchor, yaw 30°,
 * and a freestanding GraphPath heading arrow labeled with speed / yaw.
 */
export const adasEgoSurroundDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'ADAS ego + surround',
    kind: 'custom',
    domain: 'adas',
  },
  nodes: [
    {
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      label2: 'host',
      status: 'active',
      x: egoBody.x,
      y: egoBody.y,
      w: egoBody.w,
      h: egoBody.h,
      angle: EGO_YAW_DEG,
      angleAnchor: { ...REAR_AXLE },
      data: {
        fill: '#bfdbfe',
        stroke: '#1d4ed8',
        role: 'ego',
        axle: 'rear',
        speedMs: String(EGO_SPEED_MS),
        yawDeg: String(EGO_YAW_DEG),
      },
      style: {
        labelPosition: 'center',
        label: { color: '#0f172a', fontWeight: 'bold', fontSize: 11 },
        label2Position: 'bottom',
        label2: { color: '#64748b', fontSize: 10 },
        showIcon: false,
      },
    },
    traffic({
      id: 'lead',
      label: 'Lead',
      label2: 'front',
      x: 260,
      y: 40,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    traffic({
      id: 'rear',
      label: 'Rear',
      label2: 'behind',
      x: 260,
      y: 360,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    traffic({
      id: 'left',
      label: 'Left',
      label2: 'adjacent',
      x: 80,
      y: 200,
      fill: '#ffffff',
      stroke: '#334155',
    }),
    traffic({
      id: 'right',
      label: 'Right',
      label2: 'adjacent',
      x: 440,
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
  paths: [
    {
      id: 'ego-heading',
      label: `${EGO_SPEED_MS} m/s · ${EGO_YAW_DEG}°`,
      tooltip: 'Ego heading from rear axle (local origin)',
      // shaft + chevron tip (open polyline arrow)
      points: [
        { x: egoAxle.x, y: egoAxle.y },
        { x: egoTip.x, y: egoTip.y },
        { x: tipLeft.x, y: tipLeft.y },
        { x: egoTip.x, y: egoTip.y },
        { x: tipRight.x, y: tipRight.y },
      ],
      style: {
        stroke: '#1d4ed8',
        lineWidth: 2.5,
        label: { color: '#1e3a8a', fontSize: 11, fontWeight: 'bold' },
      },
      data: { role: 'ego-heading', speedMs: String(EGO_SPEED_MS), yawDeg: String(EGO_YAW_DEG) },
    },
  ],
}

export const adasEgoSurroundSample: DemoSample = {
  id: 'adas-ego-surround',
  title: 'Ego + surround',
  group: 'adas',
  description:
    'Bird\'s-eye ego rectangle (rear-axle angleAnchor, 30° yaw) with heading GraphPath labeled speed/yaw, plus four surround vehicles.',
  document: adasEgoSurroundDocument,
}

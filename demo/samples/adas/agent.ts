import type { GraphDocument, GraphNode, GraphPath } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import { DEMO_HEADING_VECTOR_IMAGE } from '../../lib/vector-images.ts'
import type { DemoSample } from '../types.ts'
import {
  CENTER_PIVOT,
  REAR_AXLE,
  boxPx,
  egoAxleFrameNode,
} from './bev-scale.ts'
import { adasBox } from './shared.ts'

/**
 * Dynamic obstacles around an axle-frame ego.
 * Classes: Vehicle / Pedestrian / Bicycle / Truck / Bus / Unclassified
 * (中文：车辆 / 行人 / 骑行者 / 卡车 / 公交车 / 未分类).
 * Each moving agent shows heading arrow + speedMs, plus a history GraphPath
 * with `followHostId` pointing at that agent. Trails run opposite the heading
 * and end at the box center (past → present). Vehicle also carries multi-modal
 * prediction Paths (Go / Yield / Cut-in) on the same `followHostId`.
 *
 * Truck / Bus are demo subclasses of nuPlan VEHICLE (same agent paint, larger boxes).
 * Static objects live in the Static demo (`adas-static`).
 *
 * @see https://github.com/motional/nuplan-devkit (TrackedObjectType, get_pacifica_parameters)
 */

/** Representative dynamic footprints in meters (length × width), BEV. */
const BOX_M = {
  vehicle: { length: 4.5, width: 2.0 },
  pedestrian: { length: 0.8, width: 0.6 },
  bicycle: { length: 1.8, width: 0.6 },
  truck: { length: 8.5, width: 2.5 },
  bus: { length: 11.0, width: 2.55 },
  unclassified: { length: 1.2, width: 1.0 },
} as const

/** History samples along the reverse-heading ray (past → center). */
const HISTORY_SAMPLES = 4

type AgentPaint = { readonly fill: string; readonly stroke: string }

interface DynamicSpec {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly label2: string
  readonly x: number
  readonly y: number
  readonly lengthM: number
  readonly widthM: number
  readonly paint: AgentPaint
  readonly trackedObjectType: string
  readonly angle: number
  readonly angleAnchor: { readonly u: number; readonly v: number }
  readonly speedMs: number
  /** Detection confidence in `[0, 1]` — shown as an Alarm tag. */
  readonly confidence: number
}

const DYNAMIC_SPECS: readonly DynamicSpec[] = [
  {
    id: 'vehicle-1',
    type: 'vehicle',
    label: 'Vehicle',
    label2: '车辆',
    x: 70,
    y: 210,
    lengthM: BOX_M.vehicle.length,
    widthM: BOX_M.vehicle.width,
    paint: ADAS_AGENT.vehicle,
    trackedObjectType: 'VEHICLE',
    angle: 20,
    angleAnchor: REAR_AXLE,
    speedMs: 12,
    confidence: 0.94,
  },
  {
    id: 'pedestrian-1',
    type: 'pedestrian',
    label: 'Pedestrian',
    label2: '行人',
    x: 200,
    y: 50,
    lengthM: BOX_M.pedestrian.length,
    widthM: BOX_M.pedestrian.width,
    paint: ADAS_AGENT.pedestrian,
    trackedObjectType: 'PEDESTRIAN',
    angle: -35,
    angleAnchor: CENTER_PIVOT,
    speedMs: 1.4,
    confidence: 0.88,
  },
  {
    id: 'bicycle-1',
    type: 'cyclist',
    label: 'Bicycle',
    label2: '骑行者',
    x: 70,
    y: 60,
    lengthM: BOX_M.bicycle.length,
    widthM: BOX_M.bicycle.width,
    paint: ADAS_AGENT.bicycle,
    trackedObjectType: 'BICYCLE',
    angle: 45,
    angleAnchor: REAR_AXLE,
    speedMs: 5.5,
    confidence: 0.81,
  },
  {
    id: 'truck-1',
    type: 'vehicle',
    label: 'Truck',
    label2: '卡车',
    x: 400,
    y: 40,
    lengthM: BOX_M.truck.length,
    widthM: BOX_M.truck.width,
    paint: ADAS_AGENT.vehicle,
    trackedObjectType: 'TRUCK',
    angle: -15,
    angleAnchor: REAR_AXLE,
    speedMs: 8,
    confidence: 0.76,
  },
  {
    id: 'bus-1',
    type: 'vehicle',
    label: 'Bus',
    label2: '公交车',
    x: 430,
    y: 220,
    lengthM: BOX_M.bus.length,
    widthM: BOX_M.bus.width,
    paint: ADAS_AGENT.vehicle,
    trackedObjectType: 'BUS',
    angle: 10,
    angleAnchor: REAR_AXLE,
    speedMs: 6,
    confidence: 0.91,
  },
  {
    id: 'unclassified-1',
    type: 'generic',
    label: 'Unclassified',
    label2: '未分类',
    x: 200,
    y: 340,
    lengthM: BOX_M.unclassified.length,
    widthM: BOX_M.unclassified.width,
    paint: ADAS_AGENT.generic,
    trackedObjectType: 'UNCLASSIFIED',
    angle: 70,
    angleAnchor: CENTER_PIVOT,
    speedMs: 2,
    confidence: 0.62,
  },
]

/** Map detection score → alarm level (high = info, mid = warn, low = error). */
function confidenceAlarmLevel(score: number): 'info' | 'warn' | 'error' {
  if (score >= 0.9) return 'info'
  if (score >= 0.75) return 'warn'
  return 'error'
}

/**
 * World forward unit for a node `angle` (degrees).
 * Matches heading chrome: local −Y rotated by `angle` (canvas y-down).
 */
function forwardUnit(angleDeg: number): { readonly x: number; readonly y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

/**
 * History length in world px.
 * Must clear the rear of tall BEV boxes (truck/bus `h` is length) or the stroke
 * sits under the body and looks missing; also scales with speed.
 */
function historyLengthPx(speedMs: number, boxLengthPx: number): number {
  const bySpeed = Math.round(speedMs * 9)
  const clearBody = Math.round(boxLengthPx * 0.5 + 64)
  return Math.max(48, bySpeed, clearBody)
}

function dynamicNodes(): GraphNode[] {
  // English = label (below); Chinese = label2 (above).
  // Detection confidence rides as an Alarm tag (ex–Perception boxes label2).
  return DYNAMIC_SPECS.map(spec => {
    const { w, h } = boxPx(spec.lengthM, spec.widthM)
    const score = spec.confidence
    return adasBox({
      id: spec.id,
      type: spec.type,
      label: spec.label,
      label2: spec.label2,
      x: spec.x,
      y: spec.y,
      w,
      h,
      fill: spec.paint.fill,
      stroke: spec.paint.stroke,
      angle: spec.angle,
      angleAnchor: { ...spec.angleAnchor },
      vectorImage: DEMO_HEADING_VECTOR_IMAGE,
      alarms: [{
        id: `${spec.id}-score`,
        level: confidenceAlarmLevel(score),
        message: score.toFixed(2),
      }],
      style: {
        alarmVariant: 'tag',
        alarmPosition: 'topRight',
      },
      data: {
        trackedObjectType: spec.trackedObjectType,
        agentKind: 'dynamic',
        lengthM: spec.lengthM,
        widthM: spec.widthM,
        speedMs: spec.speedMs,
        score,
        ...(spec.angleAnchor === REAR_AXLE ? { axle: 'rear' } : {}),
      },
    })
  })
}

/**
 * History trail for one dynamic agent: samples along −heading ending at box center.
 * `followHostId` binds it so drag translates the trail with the agent.
 */
function historyTrail(spec: DynamicSpec): GraphPath {
  const { w, h } = boxPx(spec.lengthM, spec.widthM)
  const cx = spec.x + w / 2
  const cy = spec.y + h / 2
  const fwd = forwardUnit(spec.angle)
  const len = historyLengthPx(spec.speedMs, h)
  const last = HISTORY_SAMPLES - 1
  const points = Array.from({ length: HISTORY_SAMPLES }, (_, i) => {
    // i=0 farthest past; i=last at center (present).
    const t = (last - i) / last
    return {
      x: cx - fwd.x * len * t,
      y: cy - fwd.y * len * t,
    }
  })
  return {
    id: `${spec.id}-history`,
    followHostId: spec.id,
    points,
    style: {
      stroke: ADAS_TRAJECTORY.ego,
      lineWidth: 2,
      alpha: 0.55,
      strokeDash: [6, 6],
      shapeKind: 'lineto',
    },
    data: { kind: 'history', hostId: spec.id },
  }
}

function historyPaths(): GraphPath[] {
  return DYNAMIC_SPECS.map(historyTrail)
}

/**
 * Multi-modal prediction ahead of `vehicle-1` (ex–Prediction demo).
 * All modes `followHostId` that vehicle so drag moves them together.
 */
function predictionPathsFor(spec: DynamicSpec): GraphPath[] {
  const { w, h } = boxPx(spec.lengthM, spec.widthM)
  const cx = spec.x + w / 2
  const cy = spec.y + h / 2
  const fwd = forwardUnit(spec.angle)
  // Driver-right on y-down: opposite of history's rearward bias.
  const right = { x: -fwd.y, y: fwd.x }
  const along = (dist: number, lateral = 0): { x: number; y: number } => ({
    x: cx + fwd.x * dist + right.x * lateral,
    y: cy + fwd.y * dist + right.y * lateral,
  })
  return [
    {
      id: `${spec.id}-pred-go`,
      label: 'Go',
      followHostId: spec.id,
      points: [along(0), along(80), along(160), along(260)],
      style: {
        stroke: ADAS_TRAJECTORY.expert,
        lineWidth: 2,
        alpha: 0.9,
        shapeKind: 'lineto',
      },
      data: { kind: 'prediction', mode: 'go', confidence: 0.6, hostId: spec.id },
    },
    {
      id: `${spec.id}-pred-yield`,
      label: 'Yield',
      followHostId: spec.id,
      points: [along(0), along(70, -40), along(130, -80), along(180, -120)],
      style: {
        stroke: ADAS_AGENT.trafficCone.stroke,
        lineWidth: 2,
        alpha: 0.55,
        strokeDash: [10, 8],
        shapeKind: 'lineto',
      },
      data: { kind: 'prediction', mode: 'yield', confidence: 0.25, hostId: spec.id },
    },
    {
      id: `${spec.id}-pred-cutin`,
      label: 'Cut-in',
      followHostId: spec.id,
      // quadto: odd ≥ 3 — start + (control,end)*
      points: [
        along(0),
        along(60, 50),
        along(120, 80),
        along(200, 90),
        along(280, 70),
      ],
      style: {
        stroke: ADAS_AGENT.generic.stroke,
        lineWidth: 2,
        alpha: 0.35,
        strokeDash: [4, 6],
        shapeKind: 'quadto',
      },
      data: { kind: 'prediction', mode: 'cut-in', confidence: 0.15, hostId: spec.id },
    },
  ]
}

/** Dynamic obstacle catalog + axle-frame ego. */
export function buildAdasAgentDocument(): GraphDocument {
  const vehicle = DYNAMIC_SPECS.find(s => s.id === 'vehicle-1')
  if (vehicle === undefined) {
    throw new Error('adas-agent: missing vehicle-1 spec')
  }
  return {
    version: 1,
    meta: { title: 'ADAS agent', kind: 'custom', domain: 'adas' },
    nodes: [egoAxleFrameNode(), ...dynamicNodes()],
    edges: [],
    groups: [],
    paths: [...historyPaths(), ...predictionPathsFor(vehicle)],
  }
}

export const adasAgentSample: DemoSample = {
  id: 'adas-agent',
  title: 'Agent',
  group: 'adas',
  description:
    'Dynamic obstacles with heading + speed, confidence Alarm tags, history trails, and multi-modal prediction Paths on Vehicle (followHostId). Static objects: see Static demo.',
  get document() {
    return buildAdasAgentDocument()
  },
}

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
 * and end at the box center (past → present).
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
  },
]

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
  return DYNAMIC_SPECS.map(spec => {
    const { w, h } = boxPx(spec.lengthM, spec.widthM)
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
      data: {
        trackedObjectType: spec.trackedObjectType,
        agentKind: 'dynamic',
        lengthM: spec.lengthM,
        widthM: spec.widthM,
        speedMs: spec.speedMs,
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

/** Dynamic obstacle catalog + axle-frame ego. */
export function buildAdasAgentDocument(): GraphDocument {
  return {
    version: 1,
    meta: { title: 'ADAS agent', kind: 'custom', domain: 'adas' },
    nodes: [egoAxleFrameNode(), ...dynamicNodes()],
    edges: [],
    groups: [],
    paths: historyPaths(),
  }
}

export const adasAgentSample: DemoSample = {
  id: 'adas-agent',
  title: 'Agent',
  group: 'adas',
  description:
    'Dynamic obstacles (Vehicle / Pedestrian / Bicycle / Truck / Bus / Unclassified) with heading + speed; each has a reverse-heading followHostId history trail to the box center. Static objects: see Static demo.',
  get document() {
    return buildAdasAgentDocument()
  },
}

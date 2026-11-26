import type { GraphDocument, GraphNode, GraphShapeNode } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_BRAND, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import { DEMO_EGO_AXLE_FRAME_IMAGE } from '../../lib/vector-images.ts'
import type { DemoSample } from '../types.ts'
import { EGO_H, EGO_LENGTH_M, EGO_W, EGO_WIDTH_M, REAR_AXLE } from './bev-scale.ts'
import { fovWedge } from './sector.ts'
import { adasBox } from './shared.ts'

/**
 * Schematic OEM sensor packages on ego (public-layout sketches, not official calibration).
 * Follow chain: ego ← mounts ← FOV wedges. Compare Tesla / XPeng / IM / Huawei / Xiaomi / Waymo.
 */

type SensorKind = 'camera' | 'radar' | 'lidar' | 'ultrasonic'

/** Offset from ego body center; −Y is vehicle forward (screen up). */
interface MountSpec {
  readonly id: string
  readonly kind: SensorKind
  readonly dx: number
  readonly dy: number
  readonly tooltip: string
}

interface FovSpec {
  readonly id: string
  /** MountSpec.id — FOV apex sits on that mount and follows it. */
  readonly mountId: string
  readonly radius: number
  readonly centerDeg: number
  readonly halfFovDeg: number
  readonly alpha: number
}

interface SchemeSpec {
  readonly id: string
  readonly title: string
  readonly tagline: string
  readonly mounts: readonly MountSpec[]
  readonly fovs: readonly FovSpec[]
}

const COLS = 3
const ORIGIN_X = 70
const ORIGIN_Y = 90
const COL_GAP = 300
const ROW_GAP = 340
const MOUNT = 12

function sensorPaint(kind: SensorKind): { readonly fill: string; readonly stroke: string } {
  switch (kind) {
    case 'camera':
      return ADAS_AGENT.czoneSign
    case 'radar':
      return { fill: ADAS_TRAJECTORY.expert, stroke: ADAS_TRAJECTORY.expert }
    case 'lidar':
      return ADAS_AGENT.vehicle
    case 'ultrasonic':
      return ADAS_AGENT.pedestrian
  }
}

const MOUNT_LETTER: Record<SensorKind, string> = {
  camera: 'C',
  radar: 'R',
  lidar: 'L',
  ultrasonic: 'U',
}

function schemeSlot(index: number): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: ORIGIN_X + col * COL_GAP, y: ORIGIN_Y + row * ROW_GAP }
}

function schemeEgo(scheme: SchemeSpec, slot: { x: number; y: number }): GraphNode {
  const paint = ADAS_AGENT.ego
  return {
    id: `${scheme.id}-ego`,
    type: 'vehicle',
    label: scheme.title,
    label2: scheme.tagline,
    status: 'active',
    x: slot.x,
    y: slot.y,
    w: EGO_W,
    h: EGO_H,
    angleAnchor: { ...REAR_AXLE },
    vectorImage: DEMO_EGO_AXLE_FRAME_IMAGE,
    layerId: 'agents',
    data: {
      fill: paint.fill,
      stroke: paint.stroke,
      role: 'ego',
      axle: 'rear',
      scheme: scheme.id,
      trackedObjectType: 'EGO',
      agentKind: 'ego',
      lengthM: EGO_LENGTH_M,
      widthM: EGO_WIDTH_M,
    },
    style: {
      showIcon: false,
      labelPosition: 'bottom',
      // Nudge brand caption slightly below the default bottom gap.
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 11, offsetY: 8 },
      label2Position: 'top',
      label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
    },
  }
}

function egoCenter(ego: GraphNode): { x: number; y: number } {
  return {
    x: (ego.x ?? 0) + (ego.w ?? EGO_W) / 2,
    y: (ego.y ?? 0) + (ego.h ?? EGO_H) / 2,
  }
}

function mountNodeId(schemeId: string, mountId: string): string {
  return `${schemeId}-${mountId}`
}

function mountNode(schemeId: string, ego: GraphNode, mount: MountSpec): GraphNode {
  const c = egoCenter(ego)
  const paint = sensorPaint(mount.kind)
  return adasBox({
    id: mountNodeId(schemeId, mount.id),
    type: mount.kind,
    label: MOUNT_LETTER[mount.kind],
    x: c.x + mount.dx - MOUNT / 2,
    y: c.y + mount.dy - MOUNT / 2,
    w: MOUNT,
    h: MOUNT,
    fill: paint.fill,
    stroke: paint.stroke,
    tooltip: mount.tooltip,
    followHostId: ego.id,
    data: {
      role: 'sensor_mount',
      sensor: mount.kind,
      scheme: schemeId,
    },
    style: {
      showIcon: false,
      shadow: null,
      labelPosition: 'center',
      label: { color: ADAS_BRAND.navy, fontSize: 8, fontWeight: 'bold' },
    },
  })
}

function schemeFovs(
  schemeId: string,
  ego: GraphNode,
  mounts: readonly MountSpec[],
  fovs: readonly FovSpec[],
): GraphShapeNode[] {
  const c = egoCenter(ego)
  const mountById = new Map(mounts.map(m => [m.id, m] as const))
  return fovs.map(fov => {
    const mount = mountById.get(fov.mountId)
    if (mount === undefined) {
      throw new Error(`ADAS sensor ${schemeId}: FOV ${fov.id} references missing mount ${fov.mountId}`)
    }
    const paint = sensorPaint(mount.kind)
    const hostId = mountNodeId(schemeId, mount.id)
    return fovWedge({
      id: `${schemeId}-${fov.id}`,
      origin: { x: c.x + mount.dx, y: c.y + mount.dy },
      radius: fov.radius,
      centerDeg: fov.centerDeg,
      halfFovDeg: fov.halfFovDeg,
      fill: paint.fill,
      stroke: paint.stroke,
      alpha: fov.alpha,
      sensor: mount.kind,
      followHostId: hostId,
      layerId: 'sensors',
      data: { scheme: schemeId, hostMountId: hostId },
    })
  })
}

/** Half-body helpers (px) for mount placement on Pacifica-scale ego. */
const HW = EGO_W / 2
const HH = EGO_H / 2

const SCHEMES: readonly SchemeSpec[] = [
  {
    id: 'tesla',
    title: 'Tesla',
    tagline: 'Vision-first',
    mounts: [
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH - 2, tooltip: 'Front bumper camera' },
      { id: 'cam-main', kind: 'camera', dx: 0, dy: -HH * 0.35, tooltip: 'Windshield main' },
      { id: 'cam-narrow', kind: 'camera', dx: 6, dy: -HH * 0.35, tooltip: 'Windshield narrow' },
      { id: 'cam-wide', kind: 'camera', dx: -6, dy: -HH * 0.35, tooltip: 'Windshield wide' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: -HH * 0.15, tooltip: 'B-pillar left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: -HH * 0.15, tooltip: 'B-pillar right' },
      { id: 'cam-rear-l', kind: 'camera', dx: -HW, dy: HH * 0.35, tooltip: 'Rear left' },
      { id: 'cam-rear-r', kind: 'camera', dx: HW, dy: HH * 0.35, tooltip: 'Rear right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 6, tooltip: 'Front radar (HW4-era sketch)' },
    ],
    fovs: [
      { id: 'fov-main', mountId: 'cam-main', radius: 110, centerDeg: 90, halfFovDeg: 35, alpha: 0.2 },
      { id: 'fov-narrow', mountId: 'cam-narrow', radius: 130, centerDeg: 90, halfFovDeg: 18, alpha: 0.16 },
      { id: 'fov-left', mountId: 'cam-left', radius: 70, centerDeg: 160, halfFovDeg: 40, alpha: 0.14 },
      { id: 'fov-right', mountId: 'cam-right', radius: 70, centerDeg: 20, halfFovDeg: 40, alpha: 0.14 },
      { id: 'fov-radar', mountId: 'radar-front', radius: 100, centerDeg: 90, halfFovDeg: 45, alpha: 0.12 },
    ],
  },
  {
    id: 'xpeng',
    title: 'XPeng',
    tagline: 'Roof lidar + cams',
    mounts: [
      { id: 'lidar-roof', kind: 'lidar', dx: 0, dy: -HH * 0.05, tooltip: 'Roof lidar' },
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH - 2, tooltip: 'Front camera' },
      { id: 'cam-wind', kind: 'camera', dx: 0, dy: -HH * 0.4, tooltip: 'Windshield' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: 0, tooltip: 'Side left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: 0, tooltip: 'Side right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 8, tooltip: 'Front radar' },
      { id: 'radar-fl', kind: 'radar', dx: -HW, dy: -HH * 0.55, tooltip: 'Corner radar FL' },
      { id: 'radar-fr', kind: 'radar', dx: HW, dy: -HH * 0.55, tooltip: 'Corner radar FR' },
    ],
    fovs: [
      { id: 'fov-lidar', mountId: 'lidar-roof', radius: 120, centerDeg: 90, halfFovDeg: 135, alpha: 0.12 },
      { id: 'fov-cam', mountId: 'cam-wind', radius: 100, centerDeg: 90, halfFovDeg: 40, alpha: 0.18 },
      { id: 'fov-radar', mountId: 'radar-front', radius: 95, centerDeg: 90, halfFovDeg: 50, alpha: 0.12 },
    ],
  },
  {
    id: 'im',
    title: 'IM',
    tagline: '智己 lidar stack',
    mounts: [
      { id: 'lidar-roof', kind: 'lidar', dx: 0, dy: -HH * 0.1, tooltip: 'Roof lidar' },
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH - 2, tooltip: 'Front camera' },
      { id: 'cam-wind', kind: 'camera', dx: 0, dy: -HH * 0.4, tooltip: 'Windshield' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: -HH * 0.1, tooltip: 'Side left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: -HH * 0.1, tooltip: 'Side right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 8, tooltip: 'Front radar' },
      { id: 'radar-rear', kind: 'radar', dx: 0, dy: HH - 6, tooltip: 'Rear radar' },
      { id: 'uss-fl', kind: 'ultrasonic', dx: -HW * 0.7, dy: -HH - 1, tooltip: 'USS front left' },
      { id: 'uss-fr', kind: 'ultrasonic', dx: HW * 0.7, dy: -HH - 1, tooltip: 'USS front right' },
    ],
    fovs: [
      { id: 'fov-lidar', mountId: 'lidar-roof', radius: 115, centerDeg: 90, halfFovDeg: 140, alpha: 0.12 },
      { id: 'fov-cam', mountId: 'cam-wind', radius: 95, centerDeg: 90, halfFovDeg: 42, alpha: 0.18 },
      { id: 'fov-radar-f', mountId: 'radar-front', radius: 90, centerDeg: 90, halfFovDeg: 50, alpha: 0.12 },
      { id: 'fov-radar-r', mountId: 'radar-rear', radius: 70, centerDeg: 270, halfFovDeg: 50, alpha: 0.1 },
    ],
  },
  {
    id: 'huawei',
    title: 'Huawei',
    tagline: 'ADS dense stack',
    mounts: [
      { id: 'lidar-front', kind: 'lidar', dx: 0, dy: -HH - 4, tooltip: 'Front lidar' },
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH * 0.55, tooltip: 'Front camera bar' },
      { id: 'cam-wind', kind: 'camera', dx: 0, dy: -HH * 0.3, tooltip: 'Windshield' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: 0, tooltip: 'Side left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: 0, tooltip: 'Side right' },
      { id: 'cam-rear-l', kind: 'camera', dx: -HW, dy: HH * 0.4, tooltip: 'Rear left' },
      { id: 'cam-rear-r', kind: 'camera', dx: HW, dy: HH * 0.4, tooltip: 'Rear right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 10, tooltip: 'Front radar' },
      { id: 'radar-fl', kind: 'radar', dx: -HW, dy: -HH * 0.5, tooltip: 'Corner FL' },
      { id: 'radar-fr', kind: 'radar', dx: HW, dy: -HH * 0.5, tooltip: 'Corner FR' },
      { id: 'radar-rl', kind: 'radar', dx: -HW, dy: HH * 0.5, tooltip: 'Corner RL' },
      { id: 'radar-rr', kind: 'radar', dx: HW, dy: HH * 0.5, tooltip: 'Corner RR' },
    ],
    fovs: [
      { id: 'fov-lidar', mountId: 'lidar-front', radius: 125, centerDeg: 90, halfFovDeg: 60, alpha: 0.14 },
      { id: 'fov-cam', mountId: 'cam-wind', radius: 100, centerDeg: 90, halfFovDeg: 45, alpha: 0.16 },
      { id: 'fov-radar', mountId: 'radar-front', radius: 95, centerDeg: 90, halfFovDeg: 55, alpha: 0.12 },
      { id: 'fov-side-l', mountId: 'cam-left', radius: 65, centerDeg: 180, halfFovDeg: 35, alpha: 0.12 },
      { id: 'fov-side-r', mountId: 'cam-right', radius: 65, centerDeg: 0, halfFovDeg: 35, alpha: 0.12 },
    ],
  },
  {
    id: 'xiaomi',
    title: 'Xiaomi',
    tagline: '小米 SU7 stack',
    mounts: [
      { id: 'lidar-roof', kind: 'lidar', dx: 0, dy: -HH * 0.08, tooltip: 'Roof lidar' },
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH - 2, tooltip: 'Front camera' },
      { id: 'cam-wind', kind: 'camera', dx: 0, dy: -HH * 0.38, tooltip: 'Windshield' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: -HH * 0.05, tooltip: 'Side left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: -HH * 0.05, tooltip: 'Side right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 8, tooltip: 'Front radar' },
      { id: 'radar-fl', kind: 'radar', dx: -HW, dy: -HH * 0.5, tooltip: 'Corner radar FL' },
      { id: 'radar-fr', kind: 'radar', dx: HW, dy: -HH * 0.5, tooltip: 'Corner radar FR' },
      { id: 'uss-fl', kind: 'ultrasonic', dx: -HW * 0.65, dy: -HH - 1, tooltip: 'USS front left' },
      { id: 'uss-fr', kind: 'ultrasonic', dx: HW * 0.65, dy: -HH - 1, tooltip: 'USS front right' },
      { id: 'uss-rl', kind: 'ultrasonic', dx: -HW * 0.65, dy: HH + 1, tooltip: 'USS rear left' },
      { id: 'uss-rr', kind: 'ultrasonic', dx: HW * 0.65, dy: HH + 1, tooltip: 'USS rear right' },
    ],
    fovs: [
      { id: 'fov-lidar', mountId: 'lidar-roof', radius: 118, centerDeg: 90, halfFovDeg: 135, alpha: 0.12 },
      { id: 'fov-cam', mountId: 'cam-wind', radius: 98, centerDeg: 90, halfFovDeg: 42, alpha: 0.18 },
      { id: 'fov-radar', mountId: 'radar-front', radius: 92, centerDeg: 90, halfFovDeg: 50, alpha: 0.12 },
      { id: 'fov-side-l', mountId: 'cam-left', radius: 62, centerDeg: 175, halfFovDeg: 35, alpha: 0.12 },
      { id: 'fov-side-r', mountId: 'cam-right', radius: 62, centerDeg: 5, halfFovDeg: 35, alpha: 0.12 },
    ],
  },
  {
    id: 'waymo',
    title: 'Waymo',
    tagline: 'Robotaxi dome',
    mounts: [
      { id: 'lidar-dome', kind: 'lidar', dx: 0, dy: -HH * 0.15, tooltip: 'Roof spinning lidar' },
      { id: 'lidar-fl', kind: 'lidar', dx: -HW * 0.6, dy: -HH * 0.55, tooltip: 'Front-left lidar' },
      { id: 'lidar-fr', kind: 'lidar', dx: HW * 0.6, dy: -HH * 0.55, tooltip: 'Front-right lidar' },
      { id: 'cam-front', kind: 'camera', dx: 0, dy: -HH - 2, tooltip: 'Front camera' },
      { id: 'cam-left', kind: 'camera', dx: -HW - 2, dy: 0, tooltip: 'Side left' },
      { id: 'cam-right', kind: 'camera', dx: HW + 2, dy: 0, tooltip: 'Side right' },
      { id: 'cam-rear', kind: 'camera', dx: 0, dy: HH + 2, tooltip: 'Rear camera' },
      { id: 'radar-front', kind: 'radar', dx: 0, dy: -HH + 8, tooltip: 'Front radar' },
      { id: 'radar-left', kind: 'radar', dx: -HW - 1, dy: HH * 0.2, tooltip: 'Side radar L' },
      { id: 'radar-right', kind: 'radar', dx: HW + 1, dy: HH * 0.2, tooltip: 'Side radar R' },
    ],
    fovs: [
      { id: 'fov-dome', mountId: 'lidar-dome', radius: 130, centerDeg: 90, halfFovDeg: 180, alpha: 0.1 },
      { id: 'fov-lidar-fl', mountId: 'lidar-fl', radius: 85, centerDeg: 125, halfFovDeg: 50, alpha: 0.12 },
      { id: 'fov-lidar-fr', mountId: 'lidar-fr', radius: 85, centerDeg: 55, halfFovDeg: 50, alpha: 0.12 },
      { id: 'fov-cam', mountId: 'cam-front', radius: 90, centerDeg: 90, halfFovDeg: 40, alpha: 0.16 },
      { id: 'fov-radar', mountId: 'radar-front', radius: 100, centerDeg: 90, halfFovDeg: 50, alpha: 0.12 },
    ],
  },
]

/** Six OEM sensor packages as side-by-side axle-frame egos. */
export function buildAdasSensorDocument(): GraphDocument {
  const nodes: GraphNode[] = []
  const shapeNodes: GraphShapeNode[] = []

  SCHEMES.forEach((scheme, index) => {
    const slot = schemeSlot(index)
    const ego = schemeEgo(scheme, slot)
    nodes.push(ego)
    for (const mount of scheme.mounts) {
      nodes.push({ ...mountNode(scheme.id, ego, mount), layerId: 'agents' })
    }
    shapeNodes.push(...schemeFovs(scheme.id, ego, scheme.mounts, scheme.fovs))
  })

  return {
    version: 1,
    meta: { title: 'ADAS Sensor', kind: 'custom', domain: 'adas' },
    layers: [
      { id: 'sensors', name: 'Sensors', movable: false },
      { id: 'agents', name: 'Agents' },
    ],
    nodes,
    edges: [],
    groups: [],
    shapeNodes,
  }
}

export const adasSensorSample: DemoSample = {
  id: 'adas-sensor',
  title: 'Sensor',
  group: 'adas',
  description:
    'OEM sensor packages (Tesla / XPeng / IM / Huawei / Xiaomi / Waymo): mounts follow ego, FOV wedges follow mounts. Schematic, not official calibration.',
  get document() {
    return buildAdasSensorDocument()
  },
}

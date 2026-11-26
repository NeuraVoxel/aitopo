import type { GraphDocument, GraphNode, GraphShapeNode } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_BRAND, ADAS_TRAJECTORY } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { egoAxleFrameNode } from './bev-scale.ts'
import { fovWedge } from './sector.ts'
import { adasBox } from './shared.ts'

type SensorKind = 'camera' | 'radar' | 'lidar'

const MOUNT = 14

function sensorPaint(kind: SensorKind): { readonly fill: string; readonly stroke: string } {
  switch (kind) {
    case 'camera':
      return ADAS_AGENT.czoneSign
    case 'radar':
      return { fill: ADAS_TRAJECTORY.expert, stroke: ADAS_TRAJECTORY.expert }
    case 'lidar':
      return ADAS_AGENT.vehicle
  }
}

/**
 * Camera / radar / lidar FOV wedges as closed GraphShapeNode sectors.
 * Chain: ego (host) ← mount nodes ← FOV wedges (`followHostId`).
 */
export function buildAdasFovDocument(): GraphDocument {
  const ego = { ...egoAxleFrameNode({ x: 320, y: 280 }), layerId: 'agents' }
  const cx = (ego.x ?? 0) + (ego.w ?? 0) / 2
  const cy = (ego.y ?? 0) + (ego.h ?? 0) / 2
  // Slight offsets so mounts are distinct while staying near the roof / bumper.
  const mounts: readonly {
    readonly id: string
    readonly kind: SensorKind
    readonly label: string
    readonly label2: string
    readonly dx: number
    readonly dy: number
    readonly radius: number
    readonly halfFovDeg: number
    readonly alpha: number
  }[] = [
    {
      id: 'mount-lidar',
      kind: 'lidar',
      label: 'Lidar',
      label2: '270°',
      dx: 0,
      dy: -(ego.h ?? 0) * 0.32,
      radius: 260,
      halfFovDeg: 135,
      alpha: 0.18,
    },
    {
      id: 'mount-radar',
      kind: 'radar',
      label: 'Radar',
      label2: '120°',
      dx: -10,
      dy: -(ego.h ?? 0) * 0.42,
      radius: 220,
      halfFovDeg: 60,
      alpha: 0.28,
    },
    {
      id: 'mount-camera',
      kind: 'camera',
      label: 'Camera',
      label2: '60°',
      dx: 10,
      dy: -(ego.h ?? 0) * 0.42,
      radius: 200,
      halfFovDeg: 30,
      alpha: 0.35,
    },
  ]

  const mountNodes: GraphNode[] = mounts.map(mount => {
    const paint = sensorPaint(mount.kind)
    return {
      ...adasBox({
        id: mount.id,
        type: mount.kind,
        label: mount.label[0]!,
        x: cx + mount.dx - MOUNT / 2,
        y: cy + mount.dy - MOUNT / 2,
        w: MOUNT,
        h: MOUNT,
        fill: paint.fill,
        stroke: paint.stroke,
        tooltip: `${mount.label} mount (follows ego)`,
        followHostId: ego.id,
        data: { role: 'sensor_mount', sensor: mount.kind },
        style: {
          showIcon: false,
          shadow: null,
          labelPosition: 'center',
          label: { color: ADAS_BRAND.navy, fontSize: 9, fontWeight: 'bold' },
        },
      }),
      layerId: 'agents',
    }
  })

  const forwardDeg = 90
  const shapeNodes: GraphShapeNode[] = mounts.map(mount => {
    const paint = sensorPaint(mount.kind)
    const origin = { x: cx + mount.dx, y: cy + mount.dy }
    return fovWedge({
      id: `fov-${mount.kind}`,
      label: mount.label,
      label2: mount.label2,
      origin,
      radius: mount.radius,
      centerDeg: forwardDeg,
      halfFovDeg: mount.halfFovDeg,
      arcSteps: Math.max(16, Math.round(mount.halfFovDeg / 3)),
      fill: paint.fill,
      stroke: paint.stroke,
      alpha: mount.alpha,
      sensor: mount.kind,
      followHostId: mount.id,
      layerId: 'sensors',
      data: { hostMountId: mount.id },
    })
  })

  return {
    version: 1,
    meta: { title: 'ADAS FOV', kind: 'custom', domain: 'adas' },
    layers: [
      { id: 'sensors', name: 'Sensors', movable: false },
      { id: 'agents', name: 'Agents' },
    ],
    nodes: [ego, ...mountNodes],
    edges: [],
    groups: [],
    shapeNodes,
  }
}

export const adasFovSample: DemoSample = {
  id: 'adas-fov',
  title: 'FOV',
  group: 'adas',
  description:
    'Camera / radar / lidar mounts follow axle-frame ego; FOV wedges follow their mounts (Edit: drag ego or a mount).',
  get document() {
    return buildAdasFovDocument()
  },
}

import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphPath,
  GraphShapeNode,
} from '../../../src/protocol/types.ts'
import {
  ADAS_AGENT,
  ADAS_BRAND,
  ADAS_MAP,
  ADAS_TRAJECTORY,
} from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { egoAxleFrameNode, EGO_H, EGO_W } from './bev-scale.ts'
import { adasBox } from './shared.ts'

/**
 * Consolidated Lane showcase (nuPlan-inspired BEV map layers).
 * Three parallel lanes follow a shared S-curve spine (no merge stub).
 * Surfaces = ShapeNode; centerlines / boundaries = Path; successor = Edge.
 *
 * @see nuplan SemanticMapLayer.LANE / baseline_path / left·right boundary
 */

/** South → north extents (canvas y-down; travel toward −Y). */
const Y0 = 580
const Y1 = -40
/** Soft successor stub past the north tip of L1. */
const Y_NEXT = Y1 - 100
const LANE_W = 56
/** Spine (L1 centerline) lateral midpoint at t=0. */
const SPINE_X0 = 220
/** S lateral amplitude (world px). */
const S_AMP = 110
/** Samples along the main S (inclusive). */
const SPINE_SAMPLES = 24

type Pt = { readonly x: number; readonly y: number }

/** `t=0` south → `t=1` north along the S spine (L1 center). */
function spineAt(t: number): Pt {
  const u = clamp01(t)
  return {
    x: SPINE_X0 + S_AMP * Math.sin(2 * Math.PI * u),
    y: Y0 + (Y1 - Y0) * u,
  }
}

/** Unit tangent of travel (south → north) and driver-left unit normal. */
function frameAt(t: number): { readonly point: Pt; readonly tangent: Pt; readonly left: Pt } {
  const eps = 1e-3
  const a = spineAt(t - eps)
  const b = spineAt(t + eps)
  const tangent = unit({ x: b.x - a.x, y: b.y - a.y })
  // Driver-left when facing travel on y-down canvas: clockwise from tangent.
  const left = unit({ x: tangent.y, y: -tangent.x })
  return { point: spineAt(t), tangent, left }
}

/** Heading degrees: 0 = −Y (north); positive toward +X (matches ego world heading). */
function headingDeg(tangent: Pt): number {
  const deg = Math.atan2(tangent.x, -tangent.y) * (180 / Math.PI)
  return ((deg % 360) + 360) % 360
}

function sampleSpine(count: number, t0 = 0, t1 = 1): Pt[] {
  const n = Math.max(2, count)
  const out: Pt[] = []
  for (let i = 0; i < n; i += 1) {
    const t = t0 + (t1 - t0) * (i / (n - 1))
    out.push(spineAt(t))
  }
  return out
}

/** Offset a polyline by `distance` along driver-left (+ = left / −X when going north). */
function offsetPolyline(points: readonly Pt[], distance: number): Pt[] {
  if (points.length < 2) return [...points]
  return points.map((point, i) => {
    const prev = points[Math.max(0, i - 1)]!
    const next = points[Math.min(points.length - 1, i + 1)]!
    const tangent = unit({ x: next.x - prev.x, y: next.y - prev.y })
    const left = unit({ x: tangent.y, y: -tangent.x })
    return {
      x: point.x + left.x * distance,
      y: point.y + left.y * distance,
    }
  })
}

/** Closed ribbon between left and right offsets (left edge then reversed right edge). */
function ribbonPolygon(centerline: readonly Pt[], halfWidth: number): Pt[] {
  const left = offsetPolyline(centerline, halfWidth)
  const right = offsetPolyline(centerline, -halfWidth)
  return [...left, ...right.slice().reverse()]
}

function laneSurface(args: {
  readonly id: string
  readonly label: string
  readonly laneKind: 'normal' | 'virtual' | 'ego_occupancy'
  readonly centerOffset: number
  readonly alpha?: number
  readonly fill?: string
  readonly stroke?: string
  readonly strokeDash?: readonly number[]
}): GraphShapeNode {
  const center = offsetPolyline(sampleSpine(SPINE_SAMPLES), args.centerOffset)
  return {
    id: args.id,
    label: args.label,
    layerId: 'ground',
    points: ribbonPolygon(center, LANE_W / 2),
    closed: true,
    style: {
      fill: args.fill ?? ADAS_MAP.lane.fill,
      stroke: args.stroke ?? ADAS_MAP.lane.stroke,
      lineWidth: 1.5,
      alpha: args.alpha ?? 0.55,
      ...(args.strokeDash !== undefined ? { strokeDash: [...args.strokeDash] } : {}),
      label: { color: ADAS_BRAND.lightAsphalt, fontSize: 11, fontWeight: 'bold' },
    },
    data: {
      mapLayer: 'LANE',
      laneKind: args.laneKind,
      laneId: args.label,
    },
  }
}

function centerlinePath(args: {
  readonly id: string
  readonly label: string
  readonly onRoute: boolean
  readonly centerOffset: number
  readonly t0?: number
  readonly t1?: number
  readonly samples?: number
}): GraphPath {
  const spine = sampleSpine(args.samples ?? SPINE_SAMPLES, args.t0 ?? 0, args.t1 ?? 1)
  return {
    id: args.id,
    label: args.label,
    layerId: 'lanes',
    points: offsetPolyline(spine, args.centerOffset),
    style: {
      stroke: args.onRoute ? ADAS_TRAJECTORY.ego : ADAS_MAP.baseline,
      lineWidth: args.onRoute ? 4 : 2,
      alpha: args.onRoute ? 0.95 : 0.75,
      shapeKind: 'lineto',
      label: {
        color: args.onRoute ? ADAS_TRAJECTORY.ego : ADAS_BRAND.lightAsphalt,
        fontSize: 10,
        fontWeight: args.onRoute ? 'bold' : 'normal',
      },
    },
    data: {
      mapLayer: 'baseline',
      laneId: args.label,
      onRoute: args.onRoute,
    },
  }
}

function boundaryPath(args: {
  readonly id: string
  readonly label: string
  readonly kind: 'white_solid' | 'white_dashed' | 'yellow_solid' | 'curb' | 'virtual'
  readonly offset: number
}): GraphPath {
  const paint = (() => {
    switch (args.kind) {
      case 'white_solid':
        return { stroke: ADAS_AGENT.ego.fill, lineWidth: 2, dash: undefined as number[] | undefined }
      case 'white_dashed':
        return { stroke: ADAS_AGENT.ego.fill, lineWidth: 2, dash: [10, 8] as number[] }
      case 'yellow_solid':
        return { stroke: ADAS_AGENT.barrier.fill, lineWidth: 2.5, dash: undefined }
      case 'curb':
        return { stroke: ADAS_BRAND.darkAsphalt, lineWidth: 5, dash: undefined }
      case 'virtual':
        return { stroke: ADAS_MAP.laneConnector, lineWidth: 1.5, dash: [4, 6] as number[] }
    }
  })()
  return {
    id: args.id,
    label: args.label,
    layerId: 'lanes',
    points: offsetPolyline(sampleSpine(SPINE_SAMPLES), args.offset),
    style: {
      stroke: paint.stroke,
      lineWidth: paint.lineWidth,
      ...(paint.dash !== undefined ? { strokeDash: paint.dash } : {}),
      shapeKind: 'lineto',
      label: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
    },
    data: {
      mapLayer: 'boundary',
      boundaryKind: args.kind,
    },
  }
}

/** Ground guidance chevron; tip points along travel. */
function guidanceArrow(id: string, at: ReturnType<typeof frameAt>, label: string): GraphShapeNode {
  const s = 14
  const { point, tangent, left } = at
  const tip = {
    x: point.x + tangent.x * s,
    y: point.y + tangent.y * s,
  }
  const base = {
    x: point.x - tangent.x * s * 0.5,
    y: point.y - tangent.y * s * 0.5,
  }
  const notch = {
    x: point.x - tangent.x * s * 0.15,
    y: point.y - tangent.y * s * 0.15,
  }
  return {
    id,
    label,
    layerId: 'lanes',
    points: [
      tip,
      {
        x: base.x + left.x * s * 0.7,
        y: base.y + left.y * s * 0.7,
      },
      notch,
      {
        x: base.x - left.x * s * 0.7,
        y: base.y - left.y * s * 0.7,
      },
    ],
    closed: true,
    style: {
      fill: ADAS_BRAND.lightAsphalt,
      stroke: ADAS_AGENT.ego.fill,
      lineWidth: 1,
      alpha: 0.9,
      label: { color: ADAS_BRAND.navy, fontSize: 9 },
    },
    data: { kind: 'ground_arrow', mapLayer: 'LANE' },
  }
}

function speedLimitTag(args: {
  readonly id: string
  readonly at: ReturnType<typeof frameAt>
  readonly side: 'left' | 'right'
  readonly limit: number
  readonly laneId: string
}): GraphNode {
  const side = args.side === 'left' ? 1 : -1
  const outward = LANE_W * 1.6
  const x = args.at.point.x + args.at.left.x * side * outward - 18
  const y = args.at.point.y + args.at.left.y * side * outward - 18
  return adasBox({
    id: args.id,
    type: 'speed_limit',
    label: String(args.limit),
    label2: '限速',
    x,
    y,
    w: 36,
    h: 36,
    fill: ADAS_AGENT.ego.fill,
    stroke: ADAS_MAP.stopLine.stroke,
    angle: headingDeg(args.at.tangent),
    style: {
      labelPosition: 'insideTop',
      label2Position: 'insideBottom',
      showIcon: false,
      label: { color: ADAS_BRAND.navy, fontSize: 13, fontWeight: 'bold' },
      label2: { color: ADAS_MAP.stopLine.stroke, fontSize: 9 },
    },
    data: {
      mapLayer: 'LANE',
      kind: 'speed_limit',
      speedLimitKph: args.limit,
      laneId: args.laneId,
    },
  })
}

function topoAnchor(args: {
  readonly id: string
  readonly label: string
  readonly label2: string
  readonly at: ReturnType<typeof frameAt>
  readonly role: 'lane_end' | 'lane_start'
}): GraphNode {
  return adasBox({
    id: args.id,
    type: 'lane',
    label: args.label,
    label2: args.label2,
    x: args.at.point.x - 20,
    y: args.at.point.y - 14,
    w: 40,
    h: 28,
    fill: ADAS_MAP.lane.fill,
    stroke: ADAS_MAP.lane.stroke,
    angle: headingDeg(args.at.tangent),
    style: {
      showIcon: false,
      label: { color: ADAS_BRAND.lightAsphalt, fontSize: 10, fontWeight: 'bold' },
      label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
    },
    data: {
      mapLayer: 'LANE',
      kind: args.role,
      laneId: args.label,
    },
  })
}

/** Build the consolidated Lane document (S-curve corridor). */
export function buildAdasLaneDocument(): GraphDocument {
  // Lane centers relative to L1 spine: L0 left, L2 right (driver frame).
  const OFF_L0 = LANE_W
  const OFF_L1 = 0
  const OFF_L2 = -LANE_W
  const OFF_CURB_L = LANE_W * 1.5 + 4
  const OFF_VIRTUAL = LANE_W
  const OFF_YELLOW = LANE_W * 0.5
  const OFF_WHITE_DASH = -LANE_W * 0.5
  const OFF_WHITE_R = -LANE_W * 1.5

  const egoFrame = frameAt(0.42)
  const ego = {
    ...egoAxleFrameNode({
      x: egoFrame.point.x - EGO_W / 2,
      y: egoFrame.point.y - EGO_H / 2,
    }),
    angle: headingDeg(egoFrame.tangent),
  }

  const limitFrame = frameAt(0.35)
  const arrowFrame = frameAt(0.62)
  const endFrame = frameAt(1)
  // Successor stub: continue north along the tip tangent.
  const nextStart: Pt = {
    x: endFrame.point.x + endFrame.tangent.x * (Y1 - Y_NEXT),
    y: endFrame.point.y + endFrame.tangent.y * (Y1 - Y_NEXT),
  }
  const nextFrame = {
    point: nextStart,
    tangent: endFrame.tangent,
    left: endFrame.left,
  }

  const shapeNodes: GraphShapeNode[] = [
    laneSurface({
      id: 'surf-L0',
      label: 'L0',
      laneKind: 'virtual',
      centerOffset: OFF_L0,
      alpha: 0.28,
      stroke: ADAS_MAP.laneConnector,
      strokeDash: [5, 5],
    }),
    laneSurface({
      id: 'surf-L1',
      label: 'L1',
      laneKind: 'ego_occupancy',
      centerOffset: OFF_L1,
      alpha: 0.7,
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_TRAJECTORY.ego,
    }),
    laneSurface({
      id: 'surf-L2',
      label: 'L2',
      laneKind: 'normal',
      centerOffset: OFF_L2,
      alpha: 0.5,
    }),
    guidanceArrow('arrow-L1', {
      point: {
        x: arrowFrame.point.x + arrowFrame.left.x * OFF_L1,
        y: arrowFrame.point.y + arrowFrame.left.y * OFF_L1,
      },
      tangent: arrowFrame.tangent,
      left: arrowFrame.left,
    }, '↑'),
  ]

  const paths: GraphPath[] = [
    centerlinePath({ id: 'cl-L0', label: 'L0', onRoute: false, centerOffset: OFF_L0 }),
    centerlinePath({ id: 'cl-L1', label: 'L1 ★', onRoute: true, centerOffset: OFF_L1 }),
    centerlinePath({ id: 'cl-L2', label: 'L2', onRoute: false, centerOffset: OFF_L2 }),
    {
      id: 'cl-L1-next',
      label: 'L1′',
      layerId: 'lanes',
      points: [
        endFrame.point,
        {
          x: (endFrame.point.x + nextStart.x) / 2,
          y: (endFrame.point.y + nextStart.y) / 2,
        },
        nextStart,
      ],
      style: {
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 4,
        alpha: 0.95,
        shapeKind: 'lineto',
        label: { color: ADAS_TRAJECTORY.ego, fontSize: 10, fontWeight: 'bold' },
      },
      data: { mapLayer: 'baseline', laneId: 'L1′', onRoute: true },
    },
    boundaryPath({ id: 'bnd-curb-left', label: 'curb', kind: 'curb', offset: OFF_CURB_L }),
    boundaryPath({ id: 'bnd-virtual-L0', label: 'virtual', kind: 'virtual', offset: OFF_VIRTUAL }),
    boundaryPath({ id: 'bnd-yellow-L0L1', label: 'yellow', kind: 'yellow_solid', offset: OFF_YELLOW }),
    boundaryPath({
      id: 'bnd-white-dash-L1L2',
      label: 'white dash',
      kind: 'white_dashed',
      offset: OFF_WHITE_DASH,
    }),
    boundaryPath({ id: 'bnd-white-L2', label: 'white', kind: 'white_solid', offset: OFF_WHITE_R }),
  ]

  const nodes: GraphNode[] = [
    ego,
    speedLimitTag({
      id: 'limit-L1',
      at: {
        point: {
          x: limitFrame.point.x + limitFrame.left.x * OFF_L1,
          y: limitFrame.point.y + limitFrame.left.y * OFF_L1,
        },
        tangent: limitFrame.tangent,
        left: limitFrame.left,
      },
      side: 'right',
      limit: 50,
      laneId: 'L1',
    }),
    speedLimitTag({
      id: 'limit-L2',
      at: {
        point: {
          x: limitFrame.point.x + limitFrame.left.x * OFF_L2,
          y: limitFrame.point.y + limitFrame.left.y * OFF_L2,
        },
        tangent: limitFrame.tangent,
        left: limitFrame.left,
      },
      side: 'right',
      limit: 50,
      laneId: 'L2',
    }),
    speedLimitTag({
      id: 'limit-L0',
      at: {
        point: {
          x: limitFrame.point.x + limitFrame.left.x * OFF_L0,
          y: limitFrame.point.y + limitFrame.left.y * OFF_L0,
        },
        tangent: limitFrame.tangent,
        left: limitFrame.left,
      },
      side: 'left',
      limit: 40,
      laneId: 'L0',
    }),
    topoAnchor({
      id: 'topo-L1-end',
      label: 'L1',
      label2: 'end',
      at: {
        point: {
          x: endFrame.point.x + endFrame.left.x * OFF_L1,
          y: endFrame.point.y + endFrame.left.y * OFF_L1,
        },
        tangent: endFrame.tangent,
        left: endFrame.left,
      },
      role: 'lane_end',
    }),
    topoAnchor({
      id: 'topo-L1-next-start',
      label: 'L1′',
      label2: 'start',
      at: nextFrame,
      role: 'lane_start',
    }),
  ]

  const edges: GraphEdge[] = [
    {
      id: 'succ-L1-L1n',
      from: 'topo-L1-end',
      to: 'topo-L1-next-start',
      kind: 'successor',
      label: 'succ',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 2.5,
        labelSide: 'aboveOrRight',
        label: { color: ADAS_TRAJECTORY.ego, fontSize: 10, fontWeight: 'bold' },
      },
      data: { mapLayer: 'LANE_CONNECTOR', relation: 'successor' },
    },
  ]

  return {
    version: 1,
    meta: { title: 'ADAS lane', kind: 'custom', domain: 'adas' },
    layers: [
      { id: 'ground', name: 'Ground', movable: false },
      { id: 'lanes', name: 'Lanes' },
      { id: 'agents', name: 'Agents' },
    ],
    nodes: nodes.map(n => ({ ...n, layerId: 'agents' })),
    edges: edges.map(e => ({ ...e, layerId: 'lanes' })),
    groups: [],
    paths,
    shapeNodes,
  }
}

export const adasLaneSample: DemoSample = {
  id: 'adas-lane',
  title: 'Lane',
  group: 'adas',
  description:
    'S-curve lane catalog: L0/L1/L2 surfaces + centerlines + boundaries on a shared spine, ego occupancy, successor stub, speed-limit tags, ground arrow.',
  get document() {
    return buildAdasLaneDocument()
  },
}

function unit(v: Pt): Pt {
  const len = Math.hypot(v.x, v.y)
  if (len < 1e-9) return { x: 0, y: -1 }
  return { x: v.x / len, y: v.y / len }
}

function clamp01(t: number): number {
  if (t < 0) return 0
  if (t > 1) return 1
  return t
}

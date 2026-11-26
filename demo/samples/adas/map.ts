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
  ADAS_SIGNAL,
  ADAS_TRAJECTORY,
} from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { egoAxleFrameNode, EGO_H, EGO_W } from './bev-scale.ts'
import { adasBox } from './shared.ts'

/**
 * Side-by-side SD vs HD of one shared corridor (schematic).
 * Main spine = parametric S-curve (same approach as Lane demo).
 * Three junctions along the trunk; HD conditions spread by segment.
 */

type Pt = { readonly x: number; readonly y: number }

const SD_OX = 24
const HD_OX = 500
const OY = 16
/** Top band reserved for SD/HD panel titles (keeps labels off the corridor). */
const TITLE_BAND = 44

/** Corridor extents (local; y-down). North tip sits below the title band. */
const Y_SOUTH = 680
const Y_NORTH = TITLE_BAND + 28
const SPINE_X0 = 200
const S_AMP = 78
const SPINE_SAMPLES = 28

const ROAD_HALF = 22
const LANE_W = 40

/** Junction stations along the main spine (`t` south→north). */
const T_J1 = 0.28 // signalized crossroads
const T_J2 = 0.55 // bend + PUDO
const T_J3 = 0.82 // T + carpark
const T_BLOCK = 0.12 // roadblock on south approach
const T_WALK0 = 0.4
const T_WALK1 = 0.5
const T_EGO = 0.08

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

function unit(v: Pt): Pt {
  const len = Math.hypot(v.x, v.y) || 1
  return { x: v.x / len, y: v.y / len }
}

/** `t=0` south tip → `t=1` north tip. */
function spineAt(t: number): Pt {
  const u = clamp01(t)
  return {
    x: SPINE_X0 + S_AMP * Math.sin(2 * Math.PI * u),
    y: Y_SOUTH + (Y_NORTH - Y_SOUTH) * u,
  }
}

function frameAt(t: number): { readonly point: Pt; readonly tangent: Pt; readonly left: Pt } {
  const eps = 1e-3
  const a = spineAt(t - eps)
  const b = spineAt(t + eps)
  const tangent = unit({ x: b.x - a.x, y: b.y - a.y })
  const left = unit({ x: tangent.y, y: -tangent.x })
  return { point: spineAt(t), tangent, left }
}

/** Heading degrees: 0 = −Y (north); positive toward +X (matches ego world heading). */
function headingDeg(tangent: Pt): number {
  const deg = Math.atan2(tangent.x, -tangent.y) * (180 / Math.PI)
  const wrapped = ((deg % 360) + 360) % 360
  return Math.round(wrapped * 100) / 100
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

function offsetPolyline(points: readonly Pt[], distance: number): Pt[] {
  if (points.length < 2) return [...points]
  return points.map((point, i) => {
    const prev = points[Math.max(0, i - 1)]!
    const next = points[Math.min(points.length - 1, i + 1)]!
    const tangent = unit({ x: next.x - prev.x, y: next.y - prev.y })
    const left = unit({ x: tangent.y, y: -tangent.x })
    return { x: point.x + left.x * distance, y: point.y + left.y * distance }
  })
}

function ribbonPolygon(centerline: readonly Pt[], halfWidth: number): Pt[] {
  const left = offsetPolyline(centerline, halfWidth)
  const right = offsetPolyline(centerline, -halfWidth)
  return [...left, ...right.slice().reverse()]
}

function T(ox: number, oy: number, p: Pt): Pt {
  return { x: ox + p.x, y: oy + p.y }
}

function translatePoints(ox: number, oy: number, points: readonly Pt[]): Pt[] {
  return points.map(p => T(ox, oy, p))
}

/** Straight arm from a junction along world axes (schematic stubs). */
function armPoints(center: Pt, dir: 'e' | 'w' | 'n' | 's', length: number, samples = 8): Pt[] {
  const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0
  const dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0
  const out: Pt[] = []
  for (let i = 0; i < samples; i += 1) {
    const u = i / (samples - 1)
    out.push({ x: center.x + dx * length * u, y: center.y + dy * length * u })
  }
  return out
}

function panelTitle(id: string, ox: number, oy: number, title: string, tagline: string): GraphNode {
  return adasBox({
    id,
    type: 'label',
    label: title,
    label2: tagline,
    x: ox + 8,
    y: oy + 6,
    w: 176,
    h: TITLE_BAND - 12,
    fill: ADAS_AGENT.ego.fill,
    stroke: ADAS_AGENT.ego.stroke,
    data: { role: 'panel_title' },
    style: {
      showIcon: false,
      shadow: null,
      labelPosition: 'center',
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 12 },
      label2Position: 'bottom',
      label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9, offsetY: 2 },
    },
  })
}

function roadLine(args: {
  readonly id: string
  readonly points: readonly Pt[]
  readonly stroke: string
  readonly lineWidth: number
  readonly dash?: readonly number[]
  readonly layerId?: string
  readonly alpha?: number
}): GraphPath {
  return {
    id: args.id,
    points: args.points,
    closed: false,
    layerId: args.layerId ?? 'map',
    style: {
      stroke: args.stroke,
      lineWidth: args.lineWidth,
      shapeKind: 'lineto',
      ...(args.alpha !== undefined ? { alpha: args.alpha } : {}),
      ...(args.dash !== undefined ? { strokeDash: args.dash } : {}),
    },
    data: { role: 'map_path' },
  }
}

function laneRibbon(args: {
  readonly id: string
  readonly label: string
  readonly centerline: readonly Pt[]
  readonly halfWidth: number
  readonly ox: number
  readonly oy: number
  readonly approach: string
  readonly alpha?: number
}): GraphShapeNode {
  return {
    id: args.id,
    label: args.label,
    layerId: 'ground',
    closed: true,
    points: translatePoints(args.ox, args.oy, ribbonPolygon(args.centerline, args.halfWidth)),
    style: {
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_MAP.lane.stroke,
      lineWidth: 1.25,
      alpha: args.alpha ?? 0.5,
      label: { color: ADAS_BRAND.lightAsphalt, fontSize: 9 },
    },
    data: { role: 'hd_lane', mapKind: 'hd', approach: args.approach },
  }
}

function filledPoly(args: {
  readonly id: string
  readonly label: string
  readonly points: readonly Pt[]
  readonly fill: string
  readonly stroke: string
  readonly alpha: number
  readonly role: string
  readonly ox: number
  readonly oy: number
  readonly layerId?: string
}): GraphShapeNode {
  return {
    id: args.id,
    label: args.label,
    layerId: args.layerId ?? 'map',
    closed: true,
    points: translatePoints(args.ox, args.oy, args.points),
    style: {
      fill: args.fill,
      stroke: args.stroke,
      lineWidth: 1.2,
      alpha: args.alpha,
      label: { color: ADAS_BRAND.mediumAsphalt, fontSize: 8 },
    },
    data: { role: args.role, mapKind: 'hd' },
  }
}

function sdJunction(
  id: string,
  ox: number,
  oy: number,
  center: Pt,
  label: string,
  label2: string,
  size: number,
): GraphNode {
  return adasBox({
    id,
    type: 'junction',
    label,
    label2,
    x: ox + center.x - size / 2,
    y: oy + center.y - size / 2,
    w: size,
    h: size,
    fill: ADAS_MAP.intersection.fill,
    stroke: ADAS_MAP.intersection.stroke,
    data: { role: 'sd_junction', mapKind: 'sd' },
    style: {
      showIcon: false,
      labelPosition: 'center',
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 11 },
      label2Position: 'bottom',
      label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 8, offsetY: 3 },
    },
  })
}

function buildSdPanel(ox: number, oy: number): {
  readonly nodes: GraphNode[]
  readonly paths: GraphPath[]
  readonly shapeNodes: GraphShapeNode[]
  readonly edges: GraphEdge[]
} {
  const j1 = spineAt(T_J1)
  const j2 = spineAt(T_J2)
  const j3 = spineAt(T_J3)
  const egoFrame = frameAt(T_EGO)
  const trunk = sampleSpine(SPINE_SAMPLES)

  const nodes: GraphNode[] = [
    panelTitle('sd-title', ox, oy, 'SD Map', 'S-curve · 3 junctions'),
    sdJunction('sd-j1', ox, oy, j1, 'J1', 'signals', 34),
    sdJunction('sd-j2', ox, oy, j2, 'J2', 'bend', 26),
    sdJunction('sd-j3', ox, oy, j3, 'J3', 'T', 26),
    {
      ...egoAxleFrameNode({
        x: ox + egoFrame.point.x - EGO_W / 2,
        y: oy + egoFrame.point.y - EGO_H / 2,
      }),
      id: 'sd-ego',
      label: 'Ego',
      label2: 'SD',
      angle: headingDeg(egoFrame.tangent),
      layerId: 'agents',
      style: {
        showIcon: false,
        labelPosition: 'bottom',
        label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 10, offsetY: 6 },
        label2Position: 'top',
        label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
      },
    },
  ]

  const paths: GraphPath[] = [
    roadLine({
      id: 'sd-trunk',
      points: translatePoints(ox, oy, trunk),
      stroke: ADAS_MAP.baseline,
      lineWidth: 5,
    }),
    roadLine({
      id: 'sd-j1-e',
      points: translatePoints(ox, oy, armPoints(j1, 'e', 130)),
      stroke: ADAS_MAP.baseline,
      lineWidth: 4,
    }),
    roadLine({
      id: 'sd-j1-w',
      points: translatePoints(ox, oy, armPoints(j1, 'w', 110)),
      stroke: ADAS_MAP.baseline,
      lineWidth: 4,
    }),
    roadLine({
      id: 'sd-j3-w',
      points: translatePoints(ox, oy, armPoints(j3, 'w', 120)),
      stroke: ADAS_MAP.baseline,
      lineWidth: 3.5,
    }),
  ]

  const edges: GraphEdge[] = [
    {
      id: 'sd-link-j1-j2',
      from: 'sd-j1',
      to: 'sd-j2',
      kind: 'successor',
      layerId: 'map',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_BRAND.mediumAsphalt,
        lineWidth: 1.25,
        strokeDash: [4, 4],
        alpha: 0.55,
      },
      data: { role: 'sd_link', mapKind: 'sd' },
    },
    {
      id: 'sd-link-j2-j3',
      from: 'sd-j2',
      to: 'sd-j3',
      kind: 'successor',
      layerId: 'map',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_BRAND.mediumAsphalt,
        lineWidth: 1.25,
        strokeDash: [4, 4],
        alpha: 0.55,
      },
      data: { role: 'sd_link', mapKind: 'sd' },
    },
  ]

  return { nodes, paths, shapeNodes: [], edges }
}

function buildHdPanel(ox: number, oy: number): {
  readonly nodes: GraphNode[]
  readonly paths: GraphPath[]
  readonly shapeNodes: GraphShapeNode[]
  readonly edges: GraphEdge[]
} {
  const j1 = spineAt(T_J1)
  const j2 = spineAt(T_J2)
  const j3 = spineAt(T_J3)
  const block = spineAt(T_BLOCK)
  const egoFrame = frameAt(T_EGO)
  const trunk = sampleSpine(SPINE_SAMPLES)
  const armE = armPoints(j1, 'e', 130)
  const armW = armPoints(j1, 'w', 110)
  const armPark = armPoints(j3, 'w', 120)

  const half = LANE_W / 2
  const shapeNodes: GraphShapeNode[] = [
    // One clean dual-lane trunk (Lane-demo style)
    laneRibbon({
      id: 'hd-lane-l0',
      label: 'L0',
      centerline: offsetPolyline(trunk, half),
      halfWidth: half * 0.92,
      ox,
      oy,
      approach: 'trunk',
    }),
    laneRibbon({
      id: 'hd-lane-l1',
      label: 'L1',
      centerline: offsetPolyline(trunk, -half),
      halfWidth: half * 0.92,
      ox,
      oy,
      approach: 'trunk',
    }),
    laneRibbon({
      id: 'hd-lane-e',
      label: 'E',
      centerline: armE,
      halfWidth: ROAD_HALF,
      ox,
      oy,
      approach: 'e',
      alpha: 0.42,
    }),
    laneRibbon({
      id: 'hd-lane-w',
      label: 'W',
      centerline: armW,
      halfWidth: ROAD_HALF,
      ox,
      oy,
      approach: 'w',
      alpha: 0.42,
    }),
    laneRibbon({
      id: 'hd-lane-park',
      label: 'P-rd',
      centerline: armPark,
      halfWidth: ROAD_HALF * 0.9,
      ox,
      oy,
      approach: 'park',
      alpha: 0.4,
    }),
    // Soft junction pads (small, not overlapping everything)
    filledPoly({
      id: 'hd-intersection-j1',
      label: '',
      ox,
      oy,
      points: [
        { x: j1.x - 34, y: j1.y - 34 },
        { x: j1.x + 34, y: j1.y - 34 },
        { x: j1.x + 34, y: j1.y + 34 },
        { x: j1.x - 34, y: j1.y + 34 },
      ],
      fill: ADAS_MAP.intersection.fill,
      stroke: ADAS_MAP.intersection.stroke,
      alpha: 0.35,
      role: 'hd_intersection',
      layerId: 'ground',
    }),
    filledPoly({
      id: 'hd-intersection-j2',
      label: '',
      ox,
      oy,
      points: [
        { x: j2.x - 24, y: j2.y - 24 },
        { x: j2.x + 24, y: j2.y - 24 },
        { x: j2.x + 24, y: j2.y + 24 },
        { x: j2.x - 24, y: j2.y + 24 },
      ],
      fill: ADAS_MAP.intersection.fill,
      stroke: ADAS_MAP.intersection.stroke,
      alpha: 0.28,
      role: 'hd_intersection',
      layerId: 'ground',
    }),
    filledPoly({
      id: 'hd-intersection-j3',
      label: '',
      ox,
      oy,
      points: [
        { x: j3.x - 24, y: j3.y - 24 },
        { x: j3.x + 24, y: j3.y - 24 },
        { x: j3.x + 24, y: j3.y + 24 },
        { x: j3.x - 24, y: j3.y + 24 },
      ],
      fill: ADAS_MAP.intersection.fill,
      stroke: ADAS_MAP.intersection.stroke,
      alpha: 0.28,
      role: 'hd_intersection',
      layerId: 'ground',
    }),
    // Stop + XW only at J1 (south approach)
    filledPoly({
      id: 'hd-stop-j1',
      label: 'Stop',
      ox,
      oy,
      points: [
        { x: j1.x - 28, y: j1.y + 28 },
        { x: j1.x + 28, y: j1.y + 28 },
        { x: j1.x + 28, y: j1.y + 33 },
        { x: j1.x - 28, y: j1.y + 33 },
      ],
      fill: ADAS_MAP.stopLine.fill,
      stroke: ADAS_MAP.stopLine.stroke,
      alpha: 0.9,
      role: 'hd_stop_line',
    }),
    filledPoly({
      id: 'hd-xw-j1',
      label: 'XW',
      ox,
      oy,
      points: [
        { x: j1.x - 30, y: j1.y + 38 },
        { x: j1.x + 30, y: j1.y + 38 },
        { x: j1.x + 30, y: j1.y + 52 },
        { x: j1.x - 30, y: j1.y + 52 },
      ],
      fill: ADAS_MAP.crosswalk.fill,
      stroke: ADAS_MAP.crosswalk.stroke,
      alpha: 0.5,
      role: 'hd_crosswalk',
    }),
    // Walkway mid-trunk (between J1 and J2)
    filledPoly({
      id: 'hd-walk-trunk',
      label: 'Walk',
      ox,
      oy,
      points: (() => {
        const a = frameAt(T_WALK0)
        const b = frameAt(T_WALK1)
        const d = LANE_W + 6
        const w = 12
        return [
          { x: a.point.x + a.left.x * d, y: a.point.y + a.left.y * d },
          { x: b.point.x + b.left.x * d, y: b.point.y + b.left.y * d },
          { x: b.point.x + b.left.x * (d + w), y: b.point.y + b.left.y * (d + w) },
          { x: a.point.x + a.left.x * (d + w), y: a.point.y + a.left.y * (d + w) },
        ]
      })(),
      fill: ADAS_MAP.walkway.fill,
      stroke: ADAS_MAP.walkway.stroke,
      alpha: 0.48,
      role: 'hd_walkway',
      layerId: 'ground',
    }),
    // PUDO at J2 (east of bend)
    filledPoly({
      id: 'hd-pudo',
      label: 'PUDO',
      ox,
      oy,
      points: [
        { x: j2.x + 36, y: j2.y - 16 },
        { x: j2.x + 72, y: j2.y - 18 },
        { x: j2.x + 74, y: j2.y + 14 },
        { x: j2.x + 38, y: j2.y + 16 },
      ],
      fill: ADAS_MAP.pudo.fill,
      stroke: ADAS_MAP.pudo.stroke,
      alpha: 0.42,
      role: 'hd_pudo',
      layerId: 'ground',
    }),
    // Carpark at J3 west tip
    filledPoly({
      id: 'hd-carpark',
      label: 'P',
      ox,
      oy,
      points: [
        { x: j3.x - 145, y: j3.y - 40 },
        { x: j3.x - 75, y: j3.y - 42 },
        { x: j3.x - 72, y: j3.y + 22 },
        { x: j3.x - 142, y: j3.y + 24 },
      ],
      fill: ADAS_MAP.carpark.fill,
      stroke: ADAS_MAP.carpark.stroke,
      alpha: 0.38,
      role: 'hd_carpark',
      layerId: 'ground',
    }),
    // Roadblock on south approach (not at junction)
    filledPoly({
      id: 'hd-roadblock',
      label: 'Block',
      ox,
      oy,
      points: [
        { x: block.x - 16, y: block.y - 8 },
        { x: block.x + 16, y: block.y - 8 },
        { x: block.x + 16, y: block.y + 10 },
        { x: block.x - 16, y: block.y + 10 },
      ],
      fill: ADAS_MAP.roadblock.fill,
      stroke: ADAS_MAP.roadblock.stroke,
      alpha: 0.78,
      role: 'hd_roadblock',
    }),
  ]

  const paths: GraphPath[] = [
    roadLine({
      id: 'hd-cl-l0',
      points: translatePoints(ox, oy, offsetPolyline(trunk, half)),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-l1',
      points: translatePoints(ox, oy, offsetPolyline(trunk, -half)),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-sep',
      points: translatePoints(ox, oy, trunk),
      stroke: ADAS_BRAND.darkAsphalt,
      lineWidth: 1.4,
      dash: [10, 8],
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-bd-l',
      points: translatePoints(ox, oy, offsetPolyline(trunk, LANE_W)),
      stroke: ADAS_BRAND.lightAsphalt,
      lineWidth: 1.1,
      dash: [6, 5],
      layerId: 'lanes',
      alpha: 0.7,
    }),
    roadLine({
      id: 'hd-bd-r',
      points: translatePoints(ox, oy, offsetPolyline(trunk, -LANE_W)),
      stroke: ADAS_BRAND.lightAsphalt,
      lineWidth: 1.1,
      dash: [6, 5],
      layerId: 'lanes',
      alpha: 0.7,
    }),
    roadLine({
      id: 'hd-cl-e',
      points: translatePoints(ox, oy, armE),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-w',
      points: translatePoints(ox, oy, armW),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-park',
      points: translatePoints(ox, oy, armPark),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
  ]

  const laneEnd = (id: string, p: Pt, label: string): GraphNode =>
    adasBox({
      id,
      type: 'lane_end',
      label,
      x: ox + p.x - 7,
      y: oy + p.y - 7,
      w: 14,
      h: 14,
      fill: ADAS_MAP.lane.fill,
      stroke: ADAS_TRAJECTORY.ego,
      data: { role: 'hd_lane_end', mapKind: 'hd' },
      style: {
        showIcon: false,
        shadow: null,
        labelPosition: 'center',
        label: { color: ADAS_BRAND.navy, fontSize: 8, fontWeight: 'bold' },
      },
    })

  const signal = (id: string, x: number, y: number, phase: 'green' | 'amber' | 'red'): GraphNode => {
    const paint = ADAS_SIGNAL[phase]
    return adasBox({
      id,
      type: 'traffic_light',
      label: 'TL',
      label2: phase,
      x: ox + x - 9,
      y: oy + y - 9,
      w: 18,
      h: 18,
      fill: paint.fill,
      stroke: paint.stroke,
      data: { role: 'hd_signal', mapKind: 'hd', phase },
      style: {
        showIcon: false,
        labelPosition: 'center',
        label: { color: ADAS_BRAND.navy, fontSize: 7, fontWeight: 'bold' },
        label2Position: 'bottom',
        label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 7, offsetY: 2 },
      },
    })
  }

  const hazard = (
    id: string,
    x: number,
    y: number,
    kind: 'cone' | 'barrier',
    label: string,
  ): GraphNode => {
    const paint = kind === 'cone' ? ADAS_AGENT.trafficCone : ADAS_AGENT.barrier
    return adasBox({
      id,
      type: kind,
      label,
      x: ox + x - 6,
      y: oy + y - 6,
      w: 12,
      h: 12,
      fill: paint.fill,
      stroke: paint.stroke,
      data: { role: 'hd_hazard', mapKind: 'hd', hazard: kind },
      style: {
        showIcon: false,
        shadow: null,
        labelPosition: 'center',
        label: { color: ADAS_BRAND.navy, fontSize: 7, fontWeight: 'bold' },
      },
    })
  }

  const nodes: GraphNode[] = [
    panelTitle('hd-title', ox, oy, 'HD Map', 'conditions along corridor'),
    laneEnd('hd-end-j1', j1, 'J1'),
    laneEnd('hd-end-j2', j2, 'J2'),
    laneEnd('hd-end-j3', j3, 'J3'),
    signal('hd-tl-se', j1.x + 40, j1.y + 40, 'red'),
    signal('hd-tl-sw', j1.x - 40, j1.y + 40, 'green'),
    signal('hd-tl-ne', j1.x + 40, j1.y - 40, 'amber'),
    hazard('hd-cone-1', block.x - 22, block.y, 'cone', 'C'),
    hazard('hd-cone-2', block.x + 22, block.y, 'cone', 'C'),
    hazard('hd-barrier-1', block.x, block.y + 16, 'barrier', 'B'),
    {
      ...egoAxleFrameNode({
        x: ox + egoFrame.point.x - EGO_W / 2,
        y: oy + egoFrame.point.y - EGO_H / 2,
      }),
      id: 'hd-ego',
      label: 'Ego',
      label2: 'HD',
      angle: headingDeg(egoFrame.tangent),
      layerId: 'agents',
      style: {
        showIcon: false,
        labelPosition: 'bottom',
        label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 10, offsetY: 6 },
        label2Position: 'top',
        label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
      },
    },
  ]

  const edges: GraphEdge[] = [
    {
      id: 'hd-succ-j1-j2',
      from: 'hd-end-j1',
      to: 'hd-end-j2',
      kind: 'successor',
      layerId: 'lanes',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 1.75,
        alpha: 0.75,
      },
      data: { role: 'lane_successor', mapKind: 'hd' },
    },
    {
      id: 'hd-succ-j2-j3',
      from: 'hd-end-j2',
      to: 'hd-end-j3',
      kind: 'successor',
      layerId: 'lanes',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 1.75,
        alpha: 0.75,
      },
      data: { role: 'lane_successor', mapKind: 'hd' },
    },
  ]

  return { nodes, paths, shapeNodes, edges }
}

export function buildAdasMapDocument(): GraphDocument {
  const sd = buildSdPanel(SD_OX, OY)
  const hd = buildHdPanel(HD_OX, OY)
  return {
    version: 1,
    meta: { title: 'ADAS Map', kind: 'custom', domain: 'adas' },
    layers: [
      { id: 'ground', name: 'Ground', movable: false },
      { id: 'map', name: 'Map' },
      { id: 'lanes', name: 'Lanes' },
      { id: 'agents', name: 'Agents' },
    ],
    nodes: [
      ...sd.nodes.map(n => (n.layerId !== undefined ? n : { ...n, layerId: 'map' })),
      ...hd.nodes.map(n => (n.layerId !== undefined ? n : { ...n, layerId: 'map' })),
    ],
    edges: [...sd.edges, ...hd.edges],
    groups: [],
    paths: [...sd.paths, ...hd.paths],
    shapeNodes: [...sd.shapeNodes, ...hd.shapeNodes],
  }
}

export const adasMapSample: DemoSample = {
  id: 'adas-map',
  title: 'Map',
  group: 'adas',
  description:
    'Same S-curve corridor side-by-side: SD topology with three junctions (left) vs HD dual lanes with conditions spread along the road — signals at J1, walkway mid-trunk, PUDO at J2, carpark at J3, roadblock on the south approach (right). Schematic.',
  get document() {
    return buildAdasMapDocument()
  },
}

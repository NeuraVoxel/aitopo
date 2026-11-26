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
 * Side-by-side SD vs HD map of the same crossroads (schematic, not official tiles).
 * Left = SD (centerlines + junction). Right = HD (lanes, connectors, stop lines, signals).
 */

type Pt = { readonly x: number; readonly y: number }

const SD_OX = 40
const HD_OX = 520
const OY = 40
/** Local junction center inside each panel. */
const CX = 200
const CY = 260
const ARM = 150
const LANE_HALF = 22
const ROAD_HALF = 48

function T(ox: number, oy: number, p: Pt): Pt {
  return { x: ox + p.x, y: oy + p.y }
}

function translatePoints(ox: number, oy: number, points: readonly Pt[]): Pt[] {
  return points.map(p => T(ox, oy, p))
}

function panelTitle(id: string, ox: number, oy: number, title: string, tagline: string): GraphNode {
  return adasBox({
    id,
    type: 'label',
    label: title,
    label2: tagline,
    x: ox + 8,
    y: oy + 4,
    w: 120,
    h: 28,
    fill: ADAS_AGENT.ego.fill,
    stroke: ADAS_AGENT.ego.stroke,
    data: { role: 'panel_title' },
    style: {
      showIcon: false,
      shadow: null,
      labelPosition: 'center',
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 13 },
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
  readonly label?: string
  readonly dash?: readonly number[]
  readonly layerId?: string
}): GraphPath {
  return {
    id: args.id,
    ...(args.label !== undefined ? { label: args.label } : {}),
    points: args.points,
    closed: false,
    layerId: args.layerId ?? 'map',
    style: {
      stroke: args.stroke,
      lineWidth: args.lineWidth,
      shapeKind: 'lineto',
      ...(args.dash !== undefined ? { strokeDash: args.dash } : {}),
      ...(args.label !== undefined
        ? { label: { color: ADAS_BRAND.mediumAsphalt, fontSize: 10 } }
        : {}),
    },
    data: { role: 'map_path' },
  }
}

function rectPoly(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

/** SD panel: topological centerlines into one junction node. */
function buildSdPanel(ox: number, oy: number): {
  readonly nodes: GraphNode[]
  readonly paths: GraphPath[]
  readonly shapeNodes: GraphShapeNode[]
  readonly edges: GraphEdge[]
} {
  const j = T(ox, oy, { x: CX, y: CY })
  const nodes: GraphNode[] = [
    panelTitle('sd-title', ox, oy, 'SD Map', 'centerline topology'),
    adasBox({
      id: 'sd-junction',
      type: 'junction',
      label: 'J1',
      label2: 'crossroads',
      x: j.x - 18,
      y: j.y - 18,
      w: 36,
      h: 36,
      fill: ADAS_MAP.intersection.fill,
      stroke: ADAS_MAP.intersection.stroke,
      data: { role: 'sd_junction', mapKind: 'sd' },
      style: {
        showIcon: false,
        labelPosition: 'center',
        label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 11 },
        label2Position: 'bottom',
        label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9, offsetY: 4 },
      },
    }),
    {
      ...egoAxleFrameNode({
        x: ox + CX - EGO_W / 2,
        y: oy + CY + ARM * 0.45,
      }),
      id: 'sd-ego',
      label: 'Ego',
      label2: 'SD',
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

  const arms: { id: string; label: string; a: Pt; b: Pt }[] = [
    { id: 'sd-ns-n', label: 'N Ave', a: { x: CX, y: CY - ARM }, b: { x: CX, y: CY - 24 } },
    { id: 'sd-ns-s', label: 'S Ave', a: { x: CX, y: CY + 24 }, b: { x: CX, y: CY + ARM } },
    { id: 'sd-ew-w', label: 'W Rd', a: { x: CX - ARM, y: CY }, b: { x: CX - 24, y: CY } },
    { id: 'sd-ew-e', label: 'E Rd', a: { x: CX + 24, y: CY }, b: { x: CX + ARM, y: CY } },
  ]

  const paths = arms.map(arm =>
    roadLine({
      id: arm.id,
      label: arm.label,
      points: translatePoints(ox, oy, [arm.a, arm.b]),
      stroke: ADAS_MAP.baseline,
      lineWidth: 4,
      layerId: 'map',
    }),
  )

  return { nodes, paths, shapeNodes: [], edges: [] }
}

/** HD panel: same crossroads with lanes, connectors, stop lines, signals. */
function buildHdPanel(ox: number, oy: number): {
  readonly nodes: GraphNode[]
  readonly paths: GraphPath[]
  readonly shapeNodes: GraphShapeNode[]
  readonly edges: GraphEdge[]
} {
  const shapeNodes: GraphShapeNode[] = [
    {
      id: 'hd-intersection',
      label: 'Intersection',
      layerId: 'ground',
      points: translatePoints(ox, oy, rectPoly(CX - ROAD_HALF, CY - ROAD_HALF, ROAD_HALF * 2, ROAD_HALF * 2)),
      style: {
        fill: ADAS_MAP.intersection.fill,
        stroke: ADAS_MAP.intersection.stroke,
        lineWidth: 1.5,
        alpha: 0.45,
        label: { color: ADAS_BRAND.lightAsphalt, fontSize: 10 },
      },
      data: { role: 'hd_intersection', mapKind: 'hd' },
    },
    // Approach lane surfaces (single lane ribbons into the box).
    {
      id: 'hd-lane-n',
      label: 'L-N',
      layerId: 'ground',
      points: translatePoints(ox, oy, rectPoly(CX - LANE_HALF, CY - ARM, LANE_HALF * 2, ARM - ROAD_HALF)),
      style: {
        fill: ADAS_MAP.lane.fill,
        stroke: ADAS_MAP.lane.stroke,
        lineWidth: 1.25,
        alpha: 0.5,
        label: { color: ADAS_BRAND.lightAsphalt, fontSize: 9 },
      },
      data: { role: 'hd_lane', mapKind: 'hd', approach: 'n' },
    },
    {
      id: 'hd-lane-s',
      label: 'L-S',
      layerId: 'ground',
      points: translatePoints(ox, oy, rectPoly(CX - LANE_HALF, CY + ROAD_HALF, LANE_HALF * 2, ARM - ROAD_HALF)),
      style: {
        fill: ADAS_MAP.lane.fill,
        stroke: ADAS_MAP.lane.stroke,
        lineWidth: 1.25,
        alpha: 0.5,
        label: { color: ADAS_BRAND.lightAsphalt, fontSize: 9 },
      },
      data: { role: 'hd_lane', mapKind: 'hd', approach: 's' },
    },
    {
      id: 'hd-lane-w',
      label: 'L-W',
      layerId: 'ground',
      points: translatePoints(ox, oy, rectPoly(CX - ARM, CY - LANE_HALF, ARM - ROAD_HALF, LANE_HALF * 2)),
      style: {
        fill: ADAS_MAP.lane.fill,
        stroke: ADAS_MAP.lane.stroke,
        lineWidth: 1.25,
        alpha: 0.5,
        label: { color: ADAS_BRAND.lightAsphalt, fontSize: 9 },
      },
      data: { role: 'hd_lane', mapKind: 'hd', approach: 'w' },
    },
    {
      id: 'hd-lane-e',
      label: 'L-E',
      layerId: 'ground',
      points: translatePoints(ox, oy, rectPoly(CX + ROAD_HALF, CY - LANE_HALF, ARM - ROAD_HALF, LANE_HALF * 2)),
      style: {
        fill: ADAS_MAP.lane.fill,
        stroke: ADAS_MAP.lane.stroke,
        lineWidth: 1.25,
        alpha: 0.5,
        label: { color: ADAS_BRAND.lightAsphalt, fontSize: 9 },
      },
      data: { role: 'hd_lane', mapKind: 'hd', approach: 'e' },
    },
    // Stop lines
    {
      id: 'hd-stop-s',
      label: 'Stop',
      layerId: 'map',
      points: translatePoints(ox, oy, rectPoly(CX - LANE_HALF, CY + ROAD_HALF + 2, LANE_HALF * 2, 5)),
      style: {
        fill: ADAS_MAP.stopLine.fill,
        stroke: ADAS_MAP.stopLine.stroke,
        lineWidth: 1,
        alpha: 0.9,
        label: { color: ADAS_MAP.stopLine.stroke, fontSize: 8 },
      },
      data: { role: 'hd_stop_line', mapKind: 'hd' },
    },
    {
      id: 'hd-stop-e',
      label: 'Stop',
      layerId: 'map',
      points: translatePoints(ox, oy, rectPoly(CX + ROAD_HALF + 2, CY - LANE_HALF, 5, LANE_HALF * 2)),
      style: {
        fill: ADAS_MAP.stopLine.fill,
        stroke: ADAS_MAP.stopLine.stroke,
        lineWidth: 1,
        alpha: 0.9,
        label: { color: ADAS_MAP.stopLine.stroke, fontSize: 8 },
      },
      data: { role: 'hd_stop_line', mapKind: 'hd' },
    },
    // Crosswalks
    {
      id: 'hd-xw-s',
      label: 'XW',
      layerId: 'map',
      points: translatePoints(ox, oy, rectPoly(CX - ROAD_HALF, CY + ROAD_HALF + 10, ROAD_HALF * 2, 14)),
      style: {
        fill: ADAS_MAP.crosswalk.fill,
        stroke: ADAS_MAP.crosswalk.stroke,
        lineWidth: 1,
        alpha: 0.55,
        label: { color: ADAS_BRAND.mediumAsphalt, fontSize: 8 },
      },
      data: { role: 'hd_crosswalk', mapKind: 'hd' },
    },
  ]

  const paths: GraphPath[] = [
    // Lane centerlines
    roadLine({
      id: 'hd-cl-n',
      points: translatePoints(ox, oy, [
        { x: CX, y: CY - ARM },
        { x: CX, y: CY - ROAD_HALF },
      ]),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-s',
      points: translatePoints(ox, oy, [
        { x: CX, y: CY + ROAD_HALF },
        { x: CX, y: CY + ARM },
      ]),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-w',
      points: translatePoints(ox, oy, [
        { x: CX - ARM, y: CY },
        { x: CX - ROAD_HALF, y: CY },
      ]),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-cl-e',
      points: translatePoints(ox, oy, [
        { x: CX + ROAD_HALF, y: CY },
        { x: CX + ARM, y: CY },
      ]),
      stroke: ADAS_MAP.baseline,
      lineWidth: 2,
      layerId: 'lanes',
    }),
    // Lane boundaries (dashed)
    roadLine({
      id: 'hd-bd-s-l',
      points: translatePoints(ox, oy, [
        { x: CX - LANE_HALF, y: CY + ROAD_HALF },
        { x: CX - LANE_HALF, y: CY + ARM },
      ]),
      stroke: ADAS_BRAND.lightAsphalt,
      lineWidth: 1.25,
      dash: [6, 6],
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-bd-s-r',
      points: translatePoints(ox, oy, [
        { x: CX + LANE_HALF, y: CY + ROAD_HALF },
        { x: CX + LANE_HALF, y: CY + ARM },
      ]),
      stroke: ADAS_BRAND.lightAsphalt,
      lineWidth: 1.25,
      dash: [6, 6],
      layerId: 'lanes',
    }),
    // Lane connectors through the intersection (S→N and E→W)
    roadLine({
      id: 'hd-conn-s-n',
      label: 'conn',
      points: translatePoints(ox, oy, [
        { x: CX, y: CY + ROAD_HALF },
        { x: CX, y: CY - ROAD_HALF },
      ]),
      stroke: ADAS_MAP.laneConnector,
      lineWidth: 2,
      dash: [4, 5],
      layerId: 'lanes',
    }),
    roadLine({
      id: 'hd-conn-e-w',
      points: translatePoints(ox, oy, [
        { x: CX + ROAD_HALF, y: CY },
        { x: CX - ROAD_HALF, y: CY },
      ]),
      stroke: ADAS_MAP.laneConnector,
      lineWidth: 2,
      dash: [4, 5],
      layerId: 'lanes',
    }),
  ]

  const laneEnd = (id: string, x: number, y: number, label: string): GraphNode =>
    adasBox({
      id,
      type: 'lane_end',
      label,
      x: ox + x - 8,
      y: oy + y - 8,
      w: 16,
      h: 16,
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
      x: ox + x - 10,
      y: oy + y - 10,
      w: 20,
      h: 20,
      fill: paint.fill,
      stroke: paint.stroke,
      data: { role: 'hd_signal', mapKind: 'hd', phase },
      style: {
        showIcon: false,
        labelPosition: 'center',
        label: { color: ADAS_BRAND.navy, fontSize: 8, fontWeight: 'bold' },
        label2Position: 'bottom',
        label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 8, offsetY: 2 },
      },
    })
  }

  const nodes: GraphNode[] = [
    panelTitle('hd-title', ox, oy, 'HD Map', 'lanes · connectors · signals'),
    laneEnd('hd-end-s', CX, CY + ROAD_HALF, 'S'),
    laneEnd('hd-end-n', CX, CY - ROAD_HALF, 'N'),
    laneEnd('hd-end-e', CX + ROAD_HALF, CY, 'E'),
    laneEnd('hd-end-w', CX - ROAD_HALF, CY, 'W'),
    signal('hd-tl-se', CX + ROAD_HALF + 18, CY + ROAD_HALF + 18, 'red'),
    signal('hd-tl-sw', CX - ROAD_HALF - 18, CY + ROAD_HALF + 18, 'green'),
    signal('hd-tl-ne', CX + ROAD_HALF + 18, CY - ROAD_HALF - 18, 'amber'),
    {
      ...egoAxleFrameNode({
        x: ox + CX - EGO_W / 2,
        y: oy + CY + ARM * 0.45,
      }),
      id: 'hd-ego',
      label: 'Ego',
      label2: 'HD',
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
      id: 'hd-succ-s-n',
      from: 'hd-end-s',
      to: 'hd-end-n',
      kind: 'successor',
      label: 'succ',
      layerId: 'lanes',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 2,
        label: { color: ADAS_TRAJECTORY.ego, fontSize: 9 },
      },
      data: { role: 'lane_successor', mapKind: 'hd' },
    },
    {
      id: 'hd-succ-e-w',
      from: 'hd-end-e',
      to: 'hd-end-w',
      kind: 'successor',
      label: 'succ',
      layerId: 'lanes',
      style: {
        route: 'straight',
        arrowTo: true,
        stroke: ADAS_TRAJECTORY.ego,
        lineWidth: 2,
        label: { color: ADAS_TRAJECTORY.ego, fontSize: 9 },
      },
      data: { role: 'lane_successor', mapKind: 'hd' },
    },
  ]

  return { nodes, paths, shapeNodes, edges }
}

/** SD | HD crossroads comparison. */
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
    'Same crossroads side-by-side: SD centerline topology (left) vs HD lanes, connectors, stop lines, and signals (right). Schematic, not official tiles.',
  get document() {
    return buildAdasMapDocument()
  },
}

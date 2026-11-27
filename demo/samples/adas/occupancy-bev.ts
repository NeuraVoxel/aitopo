import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_OCCUPANCY } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import {
  CENTER_PIVOT,
  EGO_H,
  EGO_W,
  PX_PER_M,
  REAR_AXLE,
  boxPx,
  egoAxleFrameNode,
} from './bev-scale.ts'
import { adasBox } from './shared.ts'

/**
 * Ego-centric BEV occupancy (~0.5 m cells): free / occupied / unknown with
 * sensor-range + occlusion, plus a few tracked-object boxes on top — reads like
 * a perception OCC frame, not a paint-stress grid.
 */
export const CELL_M = 0.5
/** Lateral × longitudinal cells (≈ 20 m × 16 m). */
export const OCC_COLS = 40
export const OCC_ROWS = 32
/** Total occupancy GraphNodes (`OCC_COLS * OCC_ROWS`). */
export const OCC_CELL_COUNT = OCC_COLS * OCC_ROWS

/** Max lidar/camera fusion range used for the unknown fringe. */
const SENSOR_RANGE_M = 18
/** Forward half-FOV for “seen” free space (deg from +Y forward). */
const SENSOR_HALF_FOV_DEG = 70

const CELL = Math.max(10, Math.round(CELL_M * PX_PER_M))
const GAP = 0
const ORIGIN_X = 48
const ORIGIN_Y = 36
const STRIDE = CELL + GAP

/** Ego rear-axle cell (near bottom-center; forward = decreasing row). */
const EGO_COL = Math.floor(OCC_COLS / 2)
const EGO_ROW = OCC_ROWS - 5

const OCC_CELL_STYLE = {
  showIcon: false,
  shadow: null,
} as const

type OccKind = 0 | 1 | 2

/** Axis-aligned obstacle in ego frame: +x right, +y forward (meters). */
interface LocalBox {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly widthM: number
  readonly lengthM: number
}

/**
 * Parked / moving obstacles stamped into the grid (vehicle-sized blobs + curb).
 * Centers are meters from ego rear axle.
 */
const OCCUPIED_BOXES: readonly LocalBox[] = [
  { id: 'curb-left', x: -7.2, y: 10, widthM: 0.6, lengthM: 14 },
  { id: 'parked-right', x: 5.5, y: 6, widthM: 2.0, lengthM: 4.6 },
  { id: 'lead-vehicle', x: -0.4, y: 14, widthM: 2.0, lengthM: 4.5 },
  { id: 'crossing-ped', x: 2.8, y: 9.5, widthM: 0.6, lengthM: 0.8 },
]

function localToCell(xM: number, yM: number): { readonly col: number; readonly row: number } {
  return {
    col: Math.floor(EGO_COL + xM / CELL_M),
    row: Math.floor(EGO_ROW - yM / CELL_M),
  }
}

function cellCenterLocal(row: number, col: number): { readonly x: number; readonly y: number } {
  return {
    x: (col - EGO_COL + 0.5) * CELL_M,
    y: (EGO_ROW - row + 0.5) * CELL_M,
  }
}

function inLocalBox(x: number, y: number, box: LocalBox): boolean {
  return (
    Math.abs(x - box.x) <= box.widthM / 2
    && Math.abs(y - box.y) <= box.lengthM / 2
  )
}

function buildOccupiedMask(): boolean[] {
  const mask = new Array<boolean>(OCC_CELL_COUNT).fill(false)
  for (let row = 0; row < OCC_ROWS; row += 1) {
    for (let col = 0; col < OCC_COLS; col += 1) {
      const { x, y } = cellCenterLocal(row, col)
      for (const box of OCCUPIED_BOXES) {
        if (inLocalBox(x, y, box)) {
          mask[row * OCC_COLS + col] = true
          break
        }
      }
    }
  }
  // Ego footprint stays free (not an obstacle).
  const egoHalfW = (EGO_W / PX_PER_M) / 2
  const egoHalfL = (EGO_H / PX_PER_M) / 2
  for (let row = 0; row < OCC_ROWS; row += 1) {
    for (let col = 0; col < OCC_COLS; col += 1) {
      const { x, y } = cellCenterLocal(row, col)
      if (Math.abs(x) <= egoHalfW + 0.15 && y >= -egoHalfL * 0.35 && y <= egoHalfL * 0.75) {
        mask[row * OCC_COLS + col] = false
      }
    }
  }
  return mask
}

/** True when a ray from ego to (row,col) first hits an occupied cell. */
function occludedByOccupied(
  row: number,
  col: number,
  occupied: readonly boolean[],
): boolean {
  let c0 = EGO_COL
  let r0 = EGO_ROW
  const c1 = col
  const r1 = row
  const dc = Math.abs(c1 - c0)
  const dr = Math.abs(r1 - r0)
  const sc = c0 < c1 ? 1 : -1
  const sr = r0 < r1 ? 1 : -1
  let err = dc - dr
  // Walk toward target; skip the ego cell; stop before the target cell.
  for (;;) {
    if (c0 === c1 && r0 === r1) return false
    const e2 = 2 * err
    if (e2 > -dr) {
      err -= dr
      c0 += sc
    }
    if (e2 < dc) {
      err += dc
      r0 += sr
    }
    if (c0 === c1 && r0 === r1) return false
    if (r0 < 0 || r0 >= OCC_ROWS || c0 < 0 || c0 >= OCC_COLS) return false
    if (occupied[r0 * OCC_COLS + c0] === true) return true
  }
}

function inSensorFov(x: number, y: number): boolean {
  const dist = Math.hypot(x, y)
  if (dist > SENSOR_RANGE_M) return false
  if (dist < 0.4) return true
  const bearingDeg = (Math.atan2(x, y) * 180) / Math.PI
  return Math.abs(bearingDeg) <= SENSOR_HALF_FOV_DEG || y < 2
}

function occupancyKind(
  row: number,
  col: number,
  occupied: readonly boolean[],
): OccKind {
  const { x, y } = cellCenterLocal(row, col)
  if (!inSensorFov(x, y)) return 2
  if (occupied[row * OCC_COLS + col] === true) return 1
  if (occludedByOccupied(row, col, occupied)) return 2
  // Sparse far-fringe salt for “partially observed” feel.
  if (Math.hypot(x, y) > SENSOR_RANGE_M * 0.82) {
    const h = ((row * 73856093) ^ (col * 19349663)) >>> 0
    if (h % 11 === 0) return 2
  }
  return 0
}

function cellPaint(kind: OccKind): { fill: string; stroke: string } {
  if (kind === 1) return ADAS_OCCUPANCY.occupied
  if (kind === 2) return ADAS_OCCUPANCY.unknown
  return ADAS_OCCUPANCY.free
}

function cellNodes(occupied: readonly boolean[]): GraphNode[] {
  const nodes: GraphNode[] = new Array(OCC_CELL_COUNT)
  let i = 0
  for (let row = 0; row < OCC_ROWS; row += 1) {
    for (let col = 0; col < OCC_COLS; col += 1) {
      const kind = occupancyKind(row, col, occupied)
      const paint = cellPaint(kind)
      nodes[i] = adasBox({
        id: `c-${row}-${col}`,
        type: 'occupancy',
        label: '',
        x: ORIGIN_X + col * STRIDE,
        y: ORIGIN_Y + row * STRIDE,
        w: CELL,
        h: CELL,
        fill: paint.fill,
        stroke: paint.stroke,
        layerId: 'occupancy',
        data: { occupancy: kind, cellM: CELL_M },
        style: OCC_CELL_STYLE,
      })
      i += 1
    }
  }
  return nodes
}

function cellOriginPx(row: number, col: number): { readonly x: number; readonly y: number } {
  return {
    x: ORIGIN_X + col * STRIDE,
    y: ORIGIN_Y + row * STRIDE,
  }
}

/** Tracked boxes aligned to occupied clusters (detection overlay). */
function detectionNodes(): GraphNode[] {
  const parked = localToCell(5.5, 6)
  const lead = localToCell(-0.4, 14)
  const ped = localToCell(2.8, 9.5)
  const vehiclePx = boxPx(4.5, 2.0)
  const pedPx = boxPx(0.8, 0.6)
  const parkedOrigin = cellOriginPx(parked.row, parked.col)
  const leadOrigin = cellOriginPx(lead.row, lead.col)
  const pedOrigin = cellOriginPx(ped.row, ped.col)

  return [
    adasBox({
      id: 'det-parked',
      type: 'vehicle',
      label: 'Vehicle',
      label2: 'parked',
      x: parkedOrigin.x - Math.round(vehiclePx.w / 2 - CELL / 2),
      y: parkedOrigin.y - Math.round(vehiclePx.h / 2 - CELL / 2),
      w: vehiclePx.w,
      h: vehiclePx.h,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      angle: 0,
      angleAnchor: REAR_AXLE,
      layerId: 'agents',
      data: {
        role: 'detection',
        trackedObjectType: 'VEHICLE',
        occupancyHost: 'parked-right',
      },
      style: { showIcon: false, shadow: null },
    }),
    adasBox({
      id: 'det-lead',
      type: 'vehicle',
      label: 'Vehicle',
      label2: 'lead',
      x: leadOrigin.x - Math.round(vehiclePx.w / 2 - CELL / 2),
      y: leadOrigin.y - Math.round(vehiclePx.h / 2 - CELL / 2),
      w: vehiclePx.w,
      h: vehiclePx.h,
      fill: ADAS_AGENT.vehicle.fill,
      stroke: ADAS_AGENT.vehicle.stroke,
      angle: 0,
      angleAnchor: REAR_AXLE,
      layerId: 'agents',
      data: {
        role: 'detection',
        trackedObjectType: 'VEHICLE',
        speedMs: 8,
        occupancyHost: 'lead-vehicle',
      },
      style: { showIcon: false, shadow: null },
    }),
    adasBox({
      id: 'det-ped',
      type: 'pedestrian',
      label: 'Ped',
      x: pedOrigin.x - Math.round(pedPx.w / 2 - CELL / 2),
      y: pedOrigin.y - Math.round(pedPx.h / 2 - CELL / 2),
      w: pedPx.w,
      h: pedPx.h,
      fill: ADAS_AGENT.pedestrian.fill,
      stroke: ADAS_AGENT.pedestrian.stroke,
      angle: -20,
      angleAnchor: CENTER_PIVOT,
      layerId: 'agents',
      data: {
        role: 'detection',
        trackedObjectType: 'PEDESTRIAN',
        occupancyHost: 'crossing-ped',
      },
      style: { showIcon: false, shadow: null },
    }),
  ]
}

/** Ego-centric BEV occupancy + detection overlay. */
export function buildAdasOccupancyBevDocument(): GraphDocument {
  const occupied = buildOccupiedMask()
  const egoOrigin = cellOriginPx(EGO_ROW, EGO_COL)
  const egoBase = egoAxleFrameNode({
    x: egoOrigin.x - Math.round(EGO_W / 2 - CELL / 2),
    y: egoOrigin.y - Math.round(EGO_H * 0.82 - CELL / 2),
  })
  const ego: GraphNode = { ...egoBase, layerId: 'agents' }
  return {
    version: 1,
    meta: { title: 'ADAS OCC', kind: 'custom', domain: 'adas' },
    layers: [
      { id: 'occupancy', name: 'Occupancy', movable: false },
      { id: 'agents', name: 'Agents' },
    ],
    nodes: [...cellNodes(occupied), ...detectionNodes(), ego],
    edges: [],
    groups: [],
  }
}

export const adasOccupancyBevSample: DemoSample = {
  id: 'adas-occupancy-bev',
  title: 'OCC',
  group: 'adas',
  description:
    `Ego-centric BEV occupancy (${OCC_COLS}×${OCC_ROWS} @ ${CELL_M} m: free / occupied / unknown with range + occlusion) plus tracked Vehicle / Ped boxes and axle-frame Ego.`,
  get document() {
    return buildAdasOccupancyBevDocument()
  },
}

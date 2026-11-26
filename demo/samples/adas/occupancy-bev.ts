import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import { ADAS_OCCUPANCY } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { EGO_H, EGO_W, egoAxleFrameNode } from './bev-scale.ts'
import { adasBox } from './shared.ts'

/** Dense BEV grid — node count is the performance stress knob. */
export const OCC_COLS = 80
export const OCC_ROWS = 50
/** Total occupancy GraphNodes (`OCC_COLS * OCC_ROWS` = 4000). */
export const OCC_CELL_COUNT = OCC_COLS * OCC_ROWS

const CELL = 12
const GAP = 1
const ORIGIN_X = 40
const ORIGIN_Y = 40
const STRIDE = CELL + GAP

/**
 * Deterministic free / occupied / unknown map.
 * 0 free, 1 occupied, 2 unknown — clusters + fringe without a hand grid.
 */
function occupancyKind(row: number, col: number): 0 | 1 | 2 {
  // Soft unknown halo near map edges.
  if (row < 2 || col < 2 || row >= OCC_ROWS - 2 || col >= OCC_COLS - 2) {
    return 2
  }
  // Block obstacles (walls / parked blobs).
  const inBlock =
    (row >= 8 && row < 18 && col >= 12 && col < 22) ||
    (row >= 20 && row < 28 && col >= 40 && col < 55) ||
    (row >= 32 && row < 42 && col >= 18 && col < 30) ||
    (row >= 10 && row < 16 && col >= 58 && col < 72)
  if (inBlock) return 1
  // Sparse salt: pseudo-random occupied speckles.
  const h = ((row * 73856093) ^ (col * 19349663)) >>> 0
  if (h % 47 === 0) return 1
  if (h % 31 === 0) return 2
  return 0
}

function cellPaint(kind: 0 | 1 | 2): { fill: string; stroke: string } {
  if (kind === 1) return ADAS_OCCUPANCY.occupied
  if (kind === 2) return ADAS_OCCUPANCY.unknown
  return ADAS_OCCUPANCY.free
}

function cellNodes(): GraphNode[] {
  const nodes: GraphNode[] = new Array(OCC_CELL_COUNT)
  let i = 0
  for (let row = 0; row < OCC_ROWS; row += 1) {
    for (let col = 0; col < OCC_COLS; col += 1) {
      const kind = occupancyKind(row, col)
      const paint = cellPaint(kind)
      nodes[i] = adasBox({
        id: `c-${row}-${col}`,
        type: 'occupancy',
        // Empty labels — 4k text draws would dominate the paint budget.
        label: '',
        x: ORIGIN_X + col * STRIDE,
        y: ORIGIN_Y + row * STRIDE,
        w: CELL,
        h: CELL,
        fill: paint.fill,
        stroke: paint.stroke,
        data: { occupancy: kind },
        // Dense grid: opt out of the node default drop shadow (Canvas shadowBlur).
        style: { showIcon: false, shadow: null },
      })
      i += 1
    }
  }
  return nodes
}

/** Dense BEV occupancy grid — each cell is a GraphNode (engine paint stress). */
export function buildAdasOccupancyBevDocument(): GraphDocument {
  const gridW = OCC_COLS * STRIDE - GAP
  const gridH = OCC_ROWS * STRIDE - GAP
  const ego = egoAxleFrameNode({
    x: ORIGIN_X + Math.round(gridW / 2 - EGO_W / 2),
    y: ORIGIN_Y + Math.round(gridH / 2 - EGO_H / 2),
  })
  return {
    version: 1,
    meta: { title: 'ADAS OCC', kind: 'custom', domain: 'adas' },
    nodes: [...cellNodes(), ego],
    edges: [],
    groups: [],
  }
}

export const adasOccupancyBevSample: DemoSample = {
  id: 'adas-occupancy-bev',
  title: 'OCC',
  group: 'adas',
  description:
    `Dense occupancy grid (${OCC_COLS}×${OCC_ROWS} = ${OCC_CELL_COUNT} GraphNodes: free / occupied / unknown) plus axle-frame Ego — paint/hit stress sample.`,
  get document() {
    return buildAdasOccupancyBevDocument()
  },
}

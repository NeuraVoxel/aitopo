import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import { adasBox } from './shared.ts'

const CELL = 36
const GAP = 4
const ORIGIN_X = 80
const ORIGIN_Y = 60
const COLS = 8
const ROWS = 6

/** 0 free, 1 occupied, 2 unknown — coarse semantic BEV as GraphNode cells. */
const GRID: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 2, 2],
  [0, 0, 0, 0, 0, 0, 2, 2],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0],
]

const CELL_STYLE: Record<number, { fill: string; stroke: string; label: string }> = {
  0: { fill: '#ecfdf5', stroke: '#6ee7b7', label: '' },
  1: { fill: '#fee2e2', stroke: '#f87171', label: 'occ' },
  2: { fill: '#f1f5f9', stroke: '#94a3b8', label: '?' },
}

function cellNodes(): GraphNode[] {
  const nodes: GraphNode[] = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const kind = GRID[row]![col]!
      const style = CELL_STYLE[kind]!
      nodes.push(
        adasBox({
          id: `c-${row}-${col}`,
          type: 'occupancy',
          label: style.label,
          x: ORIGIN_X + col * (CELL + GAP),
          y: ORIGIN_Y + row * (CELL + GAP),
          w: CELL,
          h: CELL,
          fill: style.fill,
          stroke: style.stroke,
          data: { occupancy: kind },
        }),
      )
    }
  }
  return nodes
}

/** Coarse BEV occupancy grid — each cell is a GraphNode (no raster overlay). */
export const adasOccupancyBevDocument: GraphDocument = {
  version: 1,
  meta: { title: 'ADAS occupancy BEV', kind: 'custom', domain: 'adas' },
  nodes: [
    ...cellNodes(),
    adasBox({
      id: 'ego',
      type: 'vehicle',
      label: 'Ego',
      x: ORIGIN_X + 3 * (CELL + GAP) + 4,
      y: ORIGIN_Y + 3 * (CELL + GAP) + 4,
      w: CELL * 2 - 8,
      h: CELL - 8,
      fill: '#bfdbfe',
      stroke: '#1d4ed8',
      status: 'active',
    }),
  ],
  edges: [],
  groups: [],
}

export const adasOccupancyBevSample: DemoSample = {
  id: 'adas-occupancy-bev',
  title: 'Occupancy BEV',
  group: 'adas',
  description:
    'Coarse BEV occupancy as a GraphNode cell grid (free / occupied / unknown).',
  document: adasOccupancyBevDocument,
}

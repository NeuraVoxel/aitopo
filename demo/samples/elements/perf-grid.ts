import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/** Engine stress grid — size is the paint / hit / select knob. */
export const PERF_COLS = 80
export const PERF_ROWS = 50
/** Total stress GraphNodes (`PERF_COLS * PERF_ROWS` = 4000). */
export const PERF_CELL_COUNT = PERF_COLS * PERF_ROWS

const CELL = 12
const GAP = 1
const ORIGIN_X = 40
const ORIGIN_Y = 40
const STRIDE = CELL + GAP

/** Kill default shadow and select/hover glow pads so dirty/paint stay lean. */
const PERF_DENSE_STYLE = {
  showIcon: false,
  shadow: null,
  select: { glow: false },
  hover: { glow: false },
} as const

const FILL = '#e2e8f0'
const STROKE = '#94a3b8'

function cellNodes(): GraphNode[] {
  const nodes: GraphNode[] = new Array(PERF_CELL_COUNT)
  let i = 0
  for (let row = 0; row < PERF_ROWS; row += 1) {
    for (let col = 0; col < PERF_COLS; col += 1) {
      nodes[i] = {
        id: `p-${row}-${col}`,
        type: 'unit',
        label: '',
        x: ORIGIN_X + col * STRIDE,
        y: ORIGIN_Y + row * STRIDE,
        w: CELL,
        h: CELL,
        data: { fill: FILL, stroke: STROKE },
        style: PERF_DENSE_STYLE,
      }
      i += 1
    }
  }
  return nodes
}

/** Flat node grid for paint / hit / bulk-select stress (not domain content). */
export function buildPerfGridDocument(): GraphDocument {
  return {
    version: 1,
    meta: { title: 'Perf', kind: 'custom' },
    nodes: cellNodes(),
    edges: [],
    groups: [],
  }
}

export const perfGridSample: DemoSample = {
  id: 'elements-perf-grid',
  title: 'Perf',
  group: 'elements',
  description:
    `Engine stress grid (${PERF_COLS}×${PERF_ROWS} = ${PERF_CELL_COUNT} GraphNodes) — paint / hit / select-all drag; not a domain sample.`,
  expandPartialDirty: false,
  get document() {
    return buildPerfGridDocument()
  },
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_CHROME_MUTED,
  FLOW_EDGE_FOCAL,
  flowEdge,
  flowNode,
} from './shared.ts'

/** Three sources → merge → sink (no spider-web). */
export const flowFanInDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Fan-in merge',
    kind: 'flow',
    eyebrow: 'Flowchart · fan-in',
    diagramType: 'flowchart-fan-in',
  },
  nodes: [
    flowNode({ id: 'a', type: 'component', label: 'Source A', x: 80, y: 80 }),
    flowNode({ id: 'b', type: 'component', label: 'Source B', x: 280, y: 80 }),
    flowNode({ id: 'c', type: 'component', label: 'Source C', x: 480, y: 80 }),
    flowNode({
      id: 'merge',
      type: 'merge',
      label: 'Merge',
      x: 280,
      y: 240,
      chrome: FLOW_CHROME_MUTED,
    }),
    flowNode({
      id: 'sink',
      type: 'component',
      label: 'Sink',
      x: 280,
      y: 360,
      chrome: FLOW_CHROME_FOCAL,
    }),
  ],
  edges: [
    flowEdge({
      id: 'ea',
      from: 'a',
      to: 'merge',
      fromAnchor: 'bottom',
      toAnchor: 'left',
      waypoints: [{ x: 140, y: 268 }],
    }),
    flowEdge({ id: 'eb', from: 'b', to: 'merge' }),
    flowEdge({
      id: 'ec',
      from: 'c',
      to: 'merge',
      fromAnchor: 'bottom',
      toAnchor: 'right',
      waypoints: [{ x: 540, y: 268 }],
    }),
    flowEdge({ id: 'es', from: 'merge', to: 'sink', style: FLOW_EDGE_FOCAL }),
  ],
  groups: [],
}

export const flowFanInSample: DemoSample = {
  id: 'flow-fan-in',
  title: 'Fan-in',
  group: 'flows',
  description: 'Three aligned sources merge into one sink via a Join node.',
  document: flowFanInDocument,
}

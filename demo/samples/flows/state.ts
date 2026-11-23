import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_CHROME_MUTED,
  FLOW_EDGE_DASH,
  FLOW_EDGE_FOCAL,
  FLOW_EDGE_MUTED,
  flowEdge,
  flowNode,
} from './shared.ts'

/** Order lifecycle state machine with labeled transitions. */
export const flowStateDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Order state machine',
    kind: 'flow',
    eyebrow: 'State machine',
    diagramType: 'state-machine',
  },
  nodes: [
    flowNode({ id: 'draft', type: 'state', label: 'Draft', x: 80, y: 120 }),
    flowNode({ id: 'submitted', type: 'state', label: 'Submitted', x: 280, y: 120 }),
    flowNode({
      id: 'approved',
      type: 'state',
      label: 'Approved',
      x: 480,
      y: 120,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({ id: 'shipped', type: 'state', label: 'Shipped', x: 680, y: 120 }),
    flowNode({
      id: 'rejected',
      type: 'state',
      label: 'Rejected',
      x: 280,
      y: 280,
      chrome: FLOW_CHROME_MUTED,
    }),
  ],
  edges: [
    flowEdge({
      id: 't1',
      from: 'draft',
      to: 'submitted',
      label: 'SUBMIT',
      style: { ...FLOW_EDGE_FOCAL, stroke: '#2d3142', arrowTo: true },
    }),
    flowEdge({
      id: 't2',
      from: 'submitted',
      to: 'approved',
      label: 'APPROVE',
      style: { ...FLOW_EDGE_FOCAL, arrowTo: true },
    }),
    flowEdge({
      id: 't3',
      from: 'approved',
      to: 'shipped',
      label: 'SHIP',
      style: { stroke: '#2d3142', labelSide: 'aboveOrRight', arrowTo: true },
    }),
    flowEdge({
      id: 't4',
      from: 'submitted',
      to: 'rejected',
      label: 'REJECT',
      fromAnchor: 'bottom',
      toAnchor: 'top',
      style: { ...FLOW_EDGE_MUTED, arrowTo: true },
    }),
    flowEdge({
      id: 't5',
      from: 'rejected',
      to: 'draft',
      kind: 'dep',
      label: 'REVISE',
      fromAnchor: 'left',
      toAnchor: 'bottom',
      waypoints: [{ x: 140, y: 308 }],
      style: { ...FLOW_EDGE_DASH, arrowTo: true },
    }),
  ],
  groups: [],
}

export const flowStateSample: DemoSample = {
  id: 'flow-state',
  title: 'State',
  group: 'flows',
  description: 'Order states with SUBMIT / APPROVE / SHIP / REJECT / REVISE transitions.',
  document: flowStateDocument,
}

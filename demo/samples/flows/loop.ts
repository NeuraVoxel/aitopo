import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_CHROME_MUTED,
  FLOW_EDGE_DASH,
  FLOW_EDGE_FOCAL,
  flowEdge,
  flowNode,
} from './shared.ts'

/**
 * Hub + ring stations (diagram-design Loop): clockwise solid ring,
 * dashed write-back spokes into the shared hub.
 */
export const flowLoopDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Self-improving loop',
    kind: 'flow',
    eyebrow: 'Loop · hub',
    diagramType: 'loop',
  },
  nodes: [
    flowNode({
      id: 'hub',
      type: 'component',
      label: 'Memory',
      label2: 'shared record',
      x: 280,
      y: 200,
      chrome: FLOW_CHROME_MUTED,
    }),
    flowNode({ id: 'capture', type: 'component', label: 'Capture', x: 280, y: 40 }),
    flowNode({
      id: 'decide',
      type: 'component',
      label: 'Decide',
      x: 480,
      y: 200,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({ id: 'act', type: 'component', label: 'Act', x: 480, y: 360 }),
    flowNode({ id: 'measure', type: 'component', label: 'Measure', x: 280, y: 360 }),
    flowNode({ id: 'learn', type: 'component', label: 'Learn', x: 80, y: 200 }),
  ],
  edges: [
    flowEdge({ id: 'r1', from: 'capture', to: 'decide' }),
    flowEdge({ id: 'r2', from: 'decide', to: 'act', style: FLOW_EDGE_FOCAL }),
    flowEdge({ id: 'r3', from: 'act', to: 'measure' }),
    flowEdge({ id: 'r4', from: 'measure', to: 'learn' }),
    flowEdge({ id: 'r5', from: 'learn', to: 'capture', label: 'NEXT' }),
    flowEdge({
      id: 's-capture',
      from: 'capture',
      to: 'hub',
      kind: 'dep',
      label: 'SIGNALS',
      style: FLOW_EDGE_DASH,
    }),
    flowEdge({
      id: 's-decide',
      from: 'decide',
      to: 'hub',
      kind: 'dep',
      style: FLOW_EDGE_DASH,
    }),
    flowEdge({
      id: 's-act',
      from: 'act',
      to: 'hub',
      kind: 'dep',
      label: 'OUTCOMES',
      style: FLOW_EDGE_DASH,
    }),
    flowEdge({
      id: 's-measure',
      from: 'measure',
      to: 'hub',
      kind: 'dep',
      style: FLOW_EDGE_DASH,
    }),
    flowEdge({
      id: 's-learn',
      from: 'learn',
      to: 'hub',
      kind: 'dep',
      style: FLOW_EDGE_DASH,
    }),
  ],
  groups: [],
}

export const flowLoopSample: DemoSample = {
  id: 'flow-loop',
  title: 'Loop',
  group: 'flows',
  description: 'Ring of stations around a shared Memory hub with dashed write-backs.',
  document: flowLoopDocument,
}

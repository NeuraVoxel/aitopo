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

/** U-path process with one dashed feedback return. */
export const flowFeedbackDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Feedback loop',
    kind: 'flow',
    eyebrow: 'Flowchart · feedback',
    diagramType: 'flowchart-feedback',
  },
  nodes: [
    flowNode({ id: 'intake', type: 'component', label: 'Intake', x: 80, y: 80 }),
    flowNode({
      id: 'process',
      type: 'component',
      label: 'Process',
      x: 280,
      y: 80,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({ id: 'ship', type: 'component', label: 'Ship', x: 480, y: 80 }),
    flowNode({ id: 'measure', type: 'component', label: 'Measure', x: 480, y: 240 }),
    flowNode({
      id: 'learn',
      type: 'component',
      label: 'Learn',
      x: 80,
      y: 240,
      chrome: FLOW_CHROME_MUTED,
    }),
  ],
  edges: [
    flowEdge({ id: 'e1', from: 'intake', to: 'process' }),
    flowEdge({ id: 'e2', from: 'process', to: 'ship', style: FLOW_EDGE_FOCAL }),
    flowEdge({ id: 'e3', from: 'ship', to: 'measure' }),
    flowEdge({ id: 'e4', from: 'measure', to: 'learn' }),
    flowEdge({
      id: 'e-feedback',
      from: 'learn',
      to: 'intake',
      kind: 'dep',
      label: 'RETRY',
      fromAnchor: 'top',
      toAnchor: 'bottom',
      style: FLOW_EDGE_DASH,
    }),
  ],
  groups: [],
}

export const flowFeedbackSample: DemoSample = {
  id: 'flow-feedback',
  title: 'Feedback',
  group: 'flows',
  description: 'U-shaped primary path with one dashed RETRY return edge.',
  document: flowFeedbackDocument,
}

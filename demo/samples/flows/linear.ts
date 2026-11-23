import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_CHROME_MUTED,
  FLOW_EDGE_FOCAL,
  flowEdge,
  flowNode,
} from './shared.ts'

/** Top-down linear process (diagram-design Steps / flowchart-linear). */
export const flowLinearDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Linear process',
    kind: 'flow',
    eyebrow: 'Flowchart · linear',
    diagramType: 'flowchart-linear',
  },
  nodes: [
    flowNode({ id: 'start', type: 'state', label: 'Start', x: 280, y: 40 }),
    flowNode({ id: 'collect', type: 'component', label: 'Collect', x: 280, y: 160 }),
    flowNode({
      id: 'review',
      type: 'component',
      label: 'Review',
      x: 280,
      y: 280,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({ id: 'publish', type: 'component', label: 'Publish', x: 280, y: 400 }),
    flowNode({
      id: 'end',
      type: 'state',
      label: 'Done',
      x: 280,
      y: 520,
      chrome: FLOW_CHROME_MUTED,
    }),
  ],
  edges: [
    flowEdge({ id: 'e1', from: 'start', to: 'collect' }),
    flowEdge({ id: 'e2', from: 'collect', to: 'review' }),
    flowEdge({ id: 'e3', from: 'review', to: 'publish', style: FLOW_EDGE_FOCAL }),
    flowEdge({ id: 'e4', from: 'publish', to: 'end' }),
  ],
  groups: [],
}

export const flowLinearSample: DemoSample = {
  id: 'flow-linear',
  title: 'Linear',
  group: 'flows',
  description: 'Single-column top→down process (Start → Collect → Review → Publish → Done).',
  document: flowLinearDocument,
}

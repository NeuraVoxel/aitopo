import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_CHROME_MUTED,
  FLOW_EDGE_FOCAL,
  FLOW_EDGE_MUTED,
  flowEdge,
  flowNode,
} from './shared.ts'

/** Decision diamond with Yes right / No down and merge rejoin. */
export const flowDecisionDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Decision with merge',
    kind: 'flow',
    eyebrow: 'Flowchart · decision',
    diagramType: 'flowchart-decision',
  },
  nodes: [
    flowNode({ id: 'start', type: 'state', label: 'Start', x: 200, y: 40 }),
    flowNode({
      id: 'decide',
      type: 'decision',
      label: 'Valid?',
      x: 200,
      y: 160,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({ id: 'yes', type: 'component', label: 'Accept', x: 400, y: 160 }),
    flowNode({
      id: 'no',
      type: 'component',
      label: 'Reject',
      x: 200,
      y: 280,
      chrome: FLOW_CHROME_MUTED,
    }),
    flowNode({
      id: 'merge',
      type: 'merge',
      label: 'Join',
      x: 200,
      y: 400,
      chrome: FLOW_CHROME_MUTED,
    }),
    flowNode({ id: 'end', type: 'state', label: 'Done', x: 200, y: 520 }),
  ],
  edges: [
    flowEdge({ id: 'e-start', from: 'start', to: 'decide' }),
    flowEdge({
      id: 'e-yes',
      from: 'decide',
      to: 'yes',
      label: 'YES',
      fromAnchor: 'right',
      toAnchor: 'left',
      style: FLOW_EDGE_FOCAL,
    }),
    flowEdge({
      id: 'e-no',
      from: 'decide',
      to: 'no',
      label: 'NO',
      fromAnchor: 'bottom',
      toAnchor: 'top',
      style: FLOW_EDGE_MUTED,
    }),
    flowEdge({
      id: 'e-yes-merge',
      from: 'yes',
      to: 'merge',
      fromAnchor: 'bottom',
      toAnchor: 'right',
      waypoints: [{ x: 460, y: 428 }],
    }),
    flowEdge({
      id: 'e-no-merge',
      from: 'no',
      to: 'merge',
      style: FLOW_EDGE_MUTED,
    }),
    flowEdge({ id: 'e-end', from: 'merge', to: 'end' }),
  ],
  groups: [],
}

export const flowDecisionSample: DemoSample = {
  id: 'flow-decision',
  title: 'Decision',
  group: 'flows',
  description: 'Decision with Yes→right / No→down branches rejoining at a merge.',
  document: flowDecisionDocument,
}

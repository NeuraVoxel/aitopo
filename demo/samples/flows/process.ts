import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_EDGE_FOCAL,
  flowEdge,
  flowNode,
  laneGroup,
} from './shared.ts'

/**
 * Cross-role process map (diagram-design Process): three lanes × sparse steps,
 * label2 carries tool / payload hint.
 */
export const flowProcessDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Cross-role process',
    kind: 'flow',
    eyebrow: 'Process · lanes',
    diagramType: 'process',
  },
  nodes: [
    flowNode({
      id: 'brief',
      type: 'component',
      label: 'Brief',
      label2: 'scope · goals',
      x: 120,
      y: 100,
      groupId: 'lane-product',
    }),
    flowNode({
      id: 'approve',
      type: 'component',
      label: 'Approve',
      label2: 'sign-off',
      x: 520,
      y: 100,
      groupId: 'lane-product',
    }),
    flowNode({
      id: 'implement',
      type: 'component',
      label: 'Implement',
      label2: 'PR · CI',
      x: 320,
      y: 280,
      groupId: 'lane-eng',
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({
      id: 'test',
      type: 'component',
      label: 'Test',
      label2: 'gate',
      x: 520,
      y: 280,
      groupId: 'lane-eng',
    }),
    flowNode({
      id: 'release',
      type: 'component',
      label: 'Release',
      label2: 'rollout',
      x: 520,
      y: 460,
      groupId: 'lane-ops',
    }),
    flowNode({
      id: 'monitor',
      type: 'component',
      label: 'Monitor',
      label2: 'SLOs',
      x: 720,
      y: 460,
      groupId: 'lane-ops',
    }),
  ],
  edges: [
    flowEdge({ id: 'e-brief', from: 'brief', to: 'implement', label: 'HANDOFF' }),
    flowEdge({
      id: 'e-build',
      from: 'implement',
      to: 'test',
      style: FLOW_EDGE_FOCAL,
    }),
    flowEdge({ id: 'e-sign', from: 'test', to: 'approve', label: 'READY' }),
    flowEdge({
      id: 'e-ship',
      from: 'approve',
      to: 'release',
      label: 'GO',
      style: FLOW_EDGE_FOCAL,
    }),
    flowEdge({ id: 'e-watch', from: 'release', to: 'monitor' }),
  ],
  groups: [
    laneGroup('lane-product', 'Product', ['brief', 'approve'], 80, 40),
    laneGroup('lane-eng', 'Engineering', ['implement', 'test'], 80, 220),
    laneGroup('lane-ops', 'Operations', ['release', 'monitor'], 80, 400),
  ],
}

export const flowProcessSample: DemoSample = {
  id: 'flow-process',
  title: 'Process',
  group: 'flows',
  description: 'Three-lane process with tool/payload subtitles and handoff edges.',
  document: flowProcessDocument,
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'
import {
  FLOW_CHROME_FOCAL,
  FLOW_EDGE_FOCAL,
  flowEdge,
  flowNode,
  laneGroup,
} from './shared.ts'

/** Two-lane handoff (Operations → Engineering). */
export const flowSwimlaneDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Two-lane handoff',
    kind: 'flow',
    eyebrow: 'Flowchart · swimlane',
    diagramType: 'flowchart-swimlane',
  },
  nodes: [
    flowNode({
      id: 'req',
      type: 'component',
      label: 'Request',
      x: 120,
      y: 100,
      groupId: 'lane-ops',
    }),
    flowNode({
      id: 'triage',
      type: 'component',
      label: 'Triage',
      x: 320,
      y: 100,
      groupId: 'lane-ops',
    }),
    flowNode({
      id: 'build',
      type: 'component',
      label: 'Build',
      x: 320,
      y: 320,
      groupId: 'lane-eng',
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({
      id: 'ship',
      type: 'component',
      label: 'Ship',
      x: 520,
      y: 320,
      groupId: 'lane-eng',
    }),
  ],
  edges: [
    flowEdge({ id: 'e1', from: 'req', to: 'triage' }),
    flowEdge({
      id: 'e-handoff',
      from: 'triage',
      to: 'build',
      label: 'HANDOFF',
      style: FLOW_EDGE_FOCAL,
    }),
    flowEdge({ id: 'e3', from: 'build', to: 'ship' }),
  ],
  groups: [
    laneGroup('lane-ops', 'Operations', ['req', 'triage'], 80, 40),
    laneGroup('lane-eng', 'Engineering', ['build', 'ship'], 80, 260),
  ],
}

export const flowSwimlaneSample: DemoSample = {
  id: 'flow-swimlane',
  title: 'Swimlane',
  group: 'flows',
  description: 'Two Group lanes with a cross-lane HANDOFF edge on member ids.',
  document: flowSwimlaneDocument,
}

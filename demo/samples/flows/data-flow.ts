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

/** Role × stage sparse data pipeline (Admin / Eng / Sci / Consumer). */
export const flowDataDocument: GraphDocument = {
  version: 1,
  meta: {
    title: 'Role × stage pipeline',
    kind: 'flow',
    eyebrow: 'Data flow · pipeline',
    diagramType: 'data-flow-pipeline',
  },
  nodes: [
    flowNode({
      id: 'adm-setup',
      type: 'component',
      label: 'Setup',
      label2: 'roles',
      x: 80,
      y: 80,
    }),
    flowNode({
      id: 'adm-acl',
      type: 'component',
      label: 'ACL',
      label2: 'policy',
      x: 280,
      y: 80,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({
      id: 'eng-ingest',
      type: 'component',
      label: 'Ingest',
      label2: 'raw',
      x: 80,
      y: 220,
    }),
    flowNode({
      id: 'eng-store',
      type: 'component',
      label: 'Store',
      label2: 'landing',
      x: 280,
      y: 220,
    }),
    flowNode({
      id: 'eng-clean',
      type: 'component',
      label: 'Clean',
      label2: 'stage',
      x: 480,
      y: 220,
    }),
    flowNode({
      id: 'sci-model',
      type: 'component',
      label: 'Model',
      label2: 'insights',
      x: 480,
      y: 360,
      chrome: FLOW_CHROME_FOCAL,
    }),
    flowNode({
      id: 'con-query',
      type: 'component',
      label: 'Query',
      label2: 'read',
      x: 680,
      y: 360,
      chrome: FLOW_CHROME_MUTED,
    }),
  ],
  edges: [
    flowEdge({ id: 'e-adm', from: 'adm-setup', to: 'adm-acl', style: FLOW_EDGE_MUTED }),
    flowEdge({
      id: 'e-trigger',
      from: 'adm-setup',
      to: 'eng-ingest',
      kind: 'dep',
      label: 'OPEN',
      style: FLOW_EDGE_DASH,
    }),
    flowEdge({ id: 'e-eng1', from: 'eng-ingest', to: 'eng-store' }),
    flowEdge({ id: 'e-eng2', from: 'eng-store', to: 'eng-clean' }),
    flowEdge({
      id: 'e-cross',
      from: 'eng-clean',
      to: 'sci-model',
      label: 'ANON',
      style: FLOW_EDGE_FOCAL,
    }),
    flowEdge({
      id: 'e-pub',
      from: 'sci-model',
      to: 'con-query',
      label: 'PUBLISH',
    }),
  ],
  groups: [],
}

export const flowDataSample: DemoSample = {
  id: 'flow-data',
  title: 'Data flow',
  group: 'flows',
  description: 'Sparse role×stage pipeline with OPEN / ANON / PUBLISH edges.',
  document: flowDataDocument,
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const nodeDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Node', kind: 'custom' },
  nodes: [
    {
      id: 'plain',
      type: 'agent',
      label: 'Plain',
      x: 60,
      y: 80,
    },
    {
      id: 'labeled',
      type: 'agent',
      label: 'Primary',
      label2: 'secondary',
      tooltip: 'Tooltip on hover',
      status: 'running',
      x: 220,
      y: 80,
      style: { labelPosition: 'top', label2Position: 'bottom' },
    },
    {
      id: 'locked',
      type: 'unit',
      label: 'Locked',
      locked: true,
      x: 60,
      y: 200,
    },
    {
      id: 'service',
      type: 'service',
      label: 'Service',
      status: 'idle',
      x: 220,
      y: 200,
      style: { labelPosition: 'insideTop', showIcon: false },
    },
  ],
  edges: [],
  groups: [],
}

export const nodeSample: DemoSample = {
  id: 'node',
  title: 'Node',
  group: 'elements',
  description: 'Node types, labels, lock, and attachment positions.',
  document: nodeDocument,
}

import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const subnetworkDocument: GraphDocument = {
  version: 1,
  meta: { title: 'SubNetwork', kind: 'topology' },
  nodes: [
    {
      id: 'team-a-node',
      type: 'team',
      label: 'Team Alpha',
      networkId: 'team-a',
      status: 'idle',
      x: 80,
      y: 120,
      w: 120,
      h: 52,
    },
    {
      id: 'solo',
      type: 'agent',
      label: 'solo',
      status: 'running',
      x: 280,
      y: 120,
      w: 80,
      h: 48,
    },
  ],
  edges: [],
  groups: [],
  networks: {
    'team-a': {
      version: 1,
      meta: { title: 'Team Alpha members' },
      nodes: [
        { id: 'm1', type: 'agent', label: 'member-1', status: 'idle', x: 80, y: 100, w: 96, h: 48 },
        { id: 'm2', type: 'agent', label: 'member-2', status: 'running', x: 260, y: 100, w: 96, h: 48 },
      ],
      edges: [{ id: 'me1', from: 'm1', to: 'm2', kind: 'parent', label: 'parent' }],
    },
  },
}

export const subnetworkSample: DemoSample = {
  id: 'subnetwork',
  title: 'SubNetwork',
  group: 'elements',
  description: 'Enterable team node keyed in document.networks.',
  document: subnetworkDocument,
}

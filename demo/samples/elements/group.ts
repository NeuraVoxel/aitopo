import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const groupDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Group', kind: 'custom' },
  nodes: [
    { id: 'a', type: 'agent', label: 'A', x: 100, y: 100, groupId: 'band' },
    { id: 'b', type: 'agent', label: 'B', x: 220, y: 100, groupId: 'band' },
    { id: 'outside', type: 'agent', label: 'Outside', x: 420, y: 110 },
  ],
  edges: [{ id: 'inner', from: 'a', to: 'b', label: 'member' }],
  groups: [{
    id: 'band',
    label: 'Expanded band',
    memberIds: ['a', 'b'],
    expanded: true,
    x: 60,
    y: 48,
    // w: 280,
    // h: 140,
    style: {
      labelPosition: 'top',
      stroke: '#2563eb',
      strokeWidth: 1.5,
      fill: 'rgba(37, 99, 235, 0.08)',
      padding: 16,
    },
  }],
}

export const groupSample: DemoSample = {
  id: 'group',
  title: 'Group',
  group: 'elements',
  description: 'Expanded group band with insideTopLeft label.',
  document: groupDocument,
}

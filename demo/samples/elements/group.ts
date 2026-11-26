import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const groupDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Group', kind: 'custom' },
  nodes: [
    { id: 'a', type: 'agent', label: 'A', x: 100, y: 100, groupId: 'band' },
    { id: 'b', type: 'agent', label: 'B', x: 220, y: 100, groupId: 'band' },
    { id: 'c', type: 'agent', label: 'C', x: 100, y: 280, groupId: 'band2' },
    { id: 'd', type: 'agent', label: 'D', x: 220, y: 280, groupId: 'band2' },
    { id: 'outside', type: 'agent', label: 'Outside', x: 420, y: 180 },
  ],
  edges: [
    { id: 'inner', from: 'a', to: 'b', label: 'member' },
    { id: 'band-band', from: 'band', to: 'band2', label: 'group' },
    { id: 'band-out', from: 'band', to: 'outside', label: 'to node' },
  ],
  groups: [
    {
      id: 'band',
      label: 'Expanded band',
      memberIds: ['a', 'b'],
      expanded: true,
      x: 60,
      y: 48,
      style: {
        labelPosition: 'top',
      },
    },
    {
      id: 'band2',
      label: 'Second band',
      memberIds: ['c', 'd'],
      expanded: true,
      x: 60,
      y: 228,
      angle: 8,
      style: {
        labelPosition: 'top',
      },
    },
  ],
}

export const groupSample: DemoSample = {
  id: 'group',
  title: 'Group',
  group: 'elements',
  description: 'Group↔Group and Group↔Node edges, angle on band, member penetration.',
  document: groupDocument,
}

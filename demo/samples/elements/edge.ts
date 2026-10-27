import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Edge showcase: style gallery (top) + Group expand/collapse link behavior (bottom).
 * Double-click the band to fold — member edge hides, penetrate remaps, group endpoint stays.
 */
export const edgeDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Edge', kind: 'custom' },
  nodes: [
    { id: 'n1', type: 'agent', label: 'From', x: 60, y: 40 },
    { id: 'n2', type: 'agent', label: 'To', x: 300, y: 40 },
    { id: 'n3', type: 'agent', label: 'Dash', x: 60, y: 160 },
    { id: 'n4', type: 'agent', label: 'Bend', x: 300, y: 160 },
    { id: 'a', type: 'agent', label: 'A', x: 80, y: 320, groupId: 'band' },
    { id: 'b', type: 'agent', label: 'B', x: 200, y: 320, groupId: 'band' },
    { id: 'out', type: 'agent', label: 'Outside', x: 400, y: 320 },
  ],
  edges: [
    {
      id: 'e-ortho',
      from: 'n1',
      to: 'n2',
      kind: 'data',
      label: 'ortho',
    },
    {
      id: 'e-both',
      from: 'n2',
      to: 'n4',
      kind: 'control',
      label: 'both arrows',
      style: { arrowFrom: true, arrowTo: true },
    },
    {
      id: 'e-dash',
      from: 'n1',
      to: 'n3',
      kind: 'depends',
      label: 'dashed',
      label2: 'secondary',
      style: { strokeDash: [8, 4] },
    },
    {
      id: 'e-bend',
      from: 'n3',
      to: 'n4',
      kind: 'data',
      label: 'waypoints',
      waypoints: [{ x: 180, y: 230 }],
      style: { arrowTo: true },
    },
    {
      id: 'e-member',
      from: 'a',
      to: 'b',
      label: 'member',
    },
    {
      id: 'e-penetrate',
      from: 'a',
      to: 'out',
      label: 'penetrate',
      style: { strokeDash: [6, 3] },
    },
    {
      id: 'e-group',
      from: 'band',
      to: 'out',
      label: 'group→node',
      style: { arrowTo: true },
    },
  ],
  groups: [
    {
      id: 'band',
      label: 'Band (dblclick)',
      memberIds: ['a', 'b'],
      expanded: true,
      x: 40,
      y: 280,
      style: {
        labelPosition: 'insideTop',
        paddingTop: 28,
        collapsedLabelPosition: 'bottom',
      },
    },
  ],
}

export const edgeSample: DemoSample = {
  id: 'edge',
  title: 'Edge',
  group: 'elements',
  description:
    'Ortho / dash / arrows / waypoints, plus Group member · penetrate · group-endpoint links (dblclick fold).',
  document: edgeDocument,
}

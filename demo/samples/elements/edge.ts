import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const edgeDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Edge', kind: 'custom' },
  nodes: [
    { id: 'n1', type: 'agent', label: 'From', x: 60, y: 60, w: 80, h: 48 },
    { id: 'n2', type: 'agent', label: 'To', x: 300, y: 60, w: 80, h: 48 },
    { id: 'n3', type: 'agent', label: 'Dash', x: 60, y: 200, w: 80, h: 48 },
    { id: 'n4', type: 'agent', label: 'Bend', x: 300, y: 200, w: 80, h: 48 },
  ],
  edges: [
    {
      id: 'e-ortho',
      from: 'n1',
      to: 'n2',
      kind: 'data',
      label: 'ortho',
      style: { stroke: '#2563eb', lineWidth: 2 },
    },
    {
      id: 'e-both',
      from: 'n2',
      to: 'n4',
      kind: 'control',
      label: 'both arrows',
      style: { stroke: '#7c3aed', arrowFrom: true, arrowTo: true },
    },
    {
      id: 'e-dash',
      from: 'n1',
      to: 'n3',
      kind: 'depends',
      label: 'dashed',
      label2: 'secondary',
      style: { stroke: '#64748b', strokeDash: [8, 4], lineWidth: 1.5 },
    },
    {
      id: 'e-bend',
      from: 'n3',
      to: 'n4',
      kind: 'data',
      label: 'waypoints',
      waypoints: [{ x: 180, y: 270 }],
      style: { stroke: '#16a34a', arrowTo: true },
    },
  ],
  groups: [],
}

export const edgeSample: DemoSample = {
  id: 'edge',
  title: 'Edge',
  group: 'elements',
  description: 'Edge kinds, dashes, arrows, and waypoints.',
  document: edgeDocument,
}

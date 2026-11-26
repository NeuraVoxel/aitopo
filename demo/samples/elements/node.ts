import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Elements Node showcase: labels, lock, angle / angleAnchor, and followHostId.
 * Drag `follow-host` in Edit mode — follower node + trail path translate with it.
 */
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
    {
      id: 'angled',
      type: 'unit',
      label: 'angled',
      x: 380,
      y: 80,
      w: 72,
      h: 44,
      angle: 25,
      data: { fill: '#eff6ff', stroke: '#3b82f6' },
      style: { showIcon: false },
    },
    {
      id: 'pivot-tl',
      type: 'unit',
      label: 'pivot TL',
      x: 380,
      y: 200,
      w: 72,
      h: 44,
      angle: 340,
      angleAnchor: { u: 0, v: 0 },
      data: { fill: '#fef3c7', stroke: '#d97706' },
      style: { showIcon: false },
    },
    {
      id: 'follow-host',
      type: 'unit',
      label: 'follow host',
      x: 60,
      y: 320,
      w: 88,
      h: 44,
      data: { fill: '#ecfdf5', stroke: '#059669' },
      style: { showIcon: false, label: { fontSize: 11 } },
    },
    {
      id: 'follow-node',
      type: 'unit',
      label: 'follower',
      followHostId: 'follow-host',
      x: 200,
      y: 336,
      w: 72,
      h: 40,
      data: { fill: '#f0fdf4', stroke: '#16a34a' },
      style: { showIcon: false, label: { fontSize: 11 } },
    },
  ],
  edges: [],
  groups: [],
  paths: [
    {
      id: 'follow-trail',
      label: 'follow path',
      followHostId: 'follow-host',
      points: [
        { x: 20, y: 380 },
        { x: 50, y: 360 },
        { x: 80, y: 342 },
        { x: 104, y: 342 },
      ],
      style: {
        stroke: '#059669',
        lineWidth: 2,
        strokeDash: [6, 5],
        alpha: 0.75,
        shapeKind: 'lineto',
        label: { color: '#047857', fontSize: 10 },
      },
    },
  ],
}

export const nodeSample: DemoSample = {
  id: 'node',
  title: 'Node',
  group: 'elements',
  description:
    'Node types, labels, lock, angle / angleAnchor, attachment positions, and followHostId (drag follow host in Edit).',
  document: nodeDocument,
}

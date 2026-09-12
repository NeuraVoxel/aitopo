import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

export const alarmDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Alarm', kind: 'custom' },
  nodes: [
    {
      id: 'ok',
      type: 'agent',
      label: 'Info',
      x: 60,
      y: 100,
      alarms: [{ id: 'a-info', level: 'info', message: 'Heartbeat ok' }],
    },
    {
      id: 'warn',
      type: 'agent',
      label: 'Warn',
      x: 220,
      y: 100,
      alarms: [{ id: 'a-warn', level: 'warn', message: 'Queue backing up' }],
    },
    {
      id: 'err',
      type: 'agent',
      label: 'Error',
      x: 380,
      y: 100,
      alarms: [
        { id: 'a-err', level: 'error', message: 'Probe failed' },
        { id: 'a-stale', level: 'warn', message: 'Stale metric' },
      ],
    },
  ],
  edges: [{
    id: 'e-alarm',
    from: 'warn',
    to: 'err',
    label: 'escalates',
    alarms: [{ id: 'e-err', level: 'error', message: 'Link down' }],
  }],
  groups: [],
}

export const alarmSample: DemoSample = {
  id: 'alarm',
  title: 'Alarm',
  group: 'elements',
  description: 'Node and edge alarms at info, warn, and error.',
  document: alarmDocument,
}

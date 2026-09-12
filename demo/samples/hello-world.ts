import type { GraphDocument } from '../../src/protocol/types.ts'
import type { DemoSample } from './types.ts'

export const helloWorldDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Hello world', kind: 'custom' },
  nodes: [
    { id: 'a', type: 'agent', label: 'A', x: 80, y: 120, w: 80, h: 48 },
    { id: 'b', type: 'agent', label: 'B', x: 280, y: 120, w: 80, h: 48 },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b', label: 'link' }],
  groups: [],
}

export const helloWorldSample: DemoSample = {
  id: 'hello-world',
  title: 'Hello world',
  group: 'getting-started',
  description: 'Two nodes and one edge.',
  document: helloWorldDocument,
}

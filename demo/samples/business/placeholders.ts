import type { DemoSample } from '../types.ts'
import { helloWorldDocument } from '../hello-world.ts'

export const businessPlaceholders: DemoSample[] = [{
  id: 'dsh-event-topo',
  title: 'dsh-event-topo',
  group: 'business',
  description: 'Reserved: DeepSeek Harness event topology.',
  reserved: true,
  document: helloWorldDocument, // unused while reserved
}]

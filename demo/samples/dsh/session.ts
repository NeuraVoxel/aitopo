import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * Pre-load placeholder for the live DSH Session sample. The SessionSourceBar
 * replaces it with a workspace-grouped document built from the connected
 * dsh web instance's `session/list` data.
 */
export const dshSessionPlaceholderDocument: GraphDocument = {
  version: 1,
  meta: { title: 'DSH Sessions', kind: 'topology' },
  nodes: [
    {
      id: 'dsh-source',
      type: 'client',
      label: 'DSH Sessions',
      label2: 'live data',
      status: 'idle',
      tooltip: 'Paste the dsh web URL (with ?token=) into the source bar above and press Load',
      x: 140,
      y: 140,
    },
    {
      id: 'dsh-hint',
      type: 'runtime',
      label: 'No dsh web connected',
      label2: 'waiting for source',
      status: 'cold',
      tooltip: 'Example: dsh web: http://127.0.0.1:3081/?token=…',
      x: 420,
      y: 140,
    },
  ],
  edges: [
    { id: 'e-source-hint', from: 'dsh-source', to: 'dsh-hint', kind: 'lifecycle', label: 'load' },
  ],
  groups: [],
}

export const dshSessionSample: DemoSample = {
  id: 'dsh-session',
  title: 'Workspace',
  group: 'dsh',
  description: 'Live DSH sessions from dsh web, grouped by workspace with turn counts.',
  live: 'dsh-sessions',
  document: dshSessionPlaceholderDocument,
}

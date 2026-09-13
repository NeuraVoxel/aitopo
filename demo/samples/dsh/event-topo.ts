import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/**
 * DeepSeek Harness turn-flow topology (see deepseek-harness docs/architecture.md):
 * the CLI composes a Cordis plugin tree, plugins mount into the shared context,
 * and the agent loop drives request/stream/tool events over the session log.
 *
 * Coordinates are tuned for the orthogonal router (side-center anchors): each
 * context mount leaves on its own channel and the agent↔llm pair uses separate
 * lanes (waypoints), so no line crosses a node box or runs coincident with another.
 */
export const dshEventTopoDocument: GraphDocument = {
  version: 1,
  meta: { title: 'DSH Event Topology', kind: 'topology' },
  nodes: [
    {
      id: 'dsh-cli',
      type: 'client',
      label: 'dsh CLI',
      label2: 'profile: web',
      status: 'idle',
      tooltip: 'Launcher composes the profile bundle stack',
      data: { layer: 'launcher' },
      x: 60,
      y: 230,
    },
    {
      id: 'cordis-ctx',
      type: 'runtime',
      label: 'Cordis Context',
      label2: 'plugin tree',
      status: 'active',
      tooltip: 'Shared context: plugins contribute services, events, and effects',
      data: { layer: 'composition' },
      x: 220,
      y: 230,
    },
    {
      id: 'session-log',
      type: 'plugin',
      label: 'Session Log',
      label2: 'core/session',
      status: 'running',
      tooltip: 'Append-only SessionEvent log broadcast as session/event',
      data: { layer: 'core', ctx: 'ctx.sessions' },
      x: 340,
      y: 140,
    },
    {
      id: 'agent-loop',
      type: 'plugin',
      label: 'Agent Loop',
      label2: 'core/agent-loop',
      status: 'running',
      tooltip: 'Drives steps: model request, tool calls, turn close',
      data: { layer: 'core', ctx: 'ctx.agentLoop' },
      x: 620,
      y: 60,
    },
    {
      id: 'llm-adapter',
      type: 'plugin',
      label: 'LLM Adapter',
      label2: 'llm/llm',
      status: 'running',
      tooltip: 'Message and stream vocabulary behind the adapter seam',
      data: { layer: 'core', ctx: 'ctx.llm' },
      x: 440,
      y: 230,
    },
    {
      id: 'tool-registry',
      type: 'plugin',
      label: 'Tool Registry',
      label2: 'core/tools',
      status: 'active',
      tooltip: 'Scoped tool registry with guarded execution pipeline',
      data: { layer: 'core', ctx: 'ctx.tools' },
      x: 620,
      y: 400,
    },
  ],
  edges: [
    { id: 'e-compose', from: 'dsh-cli', to: 'cordis-ctx', kind: 'lifecycle', label: 'compose' },
    { id: 'm-session', from: 'cordis-ctx', to: 'session-log', kind: 'lifecycle', label: 'mount' },
    { id: 'm-llm', from: 'cordis-ctx', to: 'llm-adapter', kind: 'lifecycle', label: 'mount' },
    {
      id: 'm-loop',
      from: 'cordis-ctx',
      to: 'agent-loop',
      kind: 'lifecycle',
      label: 'mount',
      waypoints: [{ x: 415, y: 255 }, { x: 415, y: 85 }],
    },
    {
      id: 'm-tools',
      from: 'cordis-ctx',
      to: 'tool-registry',
      kind: 'lifecycle',
      label: 'mount',
      waypoints: [{ x: 415, y: 255 }, { x: 415, y: 425 }],
    },
    {
      id: 'ev-request',
      from: 'agent-loop',
      to: 'llm-adapter',
      kind: 'event',
      label: 'agent/request',
      waypoints: [{ x: 645, y: 210 }, { x: 465, y: 210 }],
    },
    { id: 'ev-stream', from: 'llm-adapter', to: 'agent-loop', kind: 'event', label: 'llm/stream' },
    {
      id: 'ev-tool',
      from: 'agent-loop',
      to: 'tool-registry',
      kind: 'event',
      label: 'tool/call',
      waypoints: [{ x: 665, y: 110 }, { x: 665, y: 400 }],
    },
    { id: 'ev-session', from: 'agent-loop', to: 'session-log', kind: 'event', label: 'session/event' },
  ],
  groups: [],
}

export const dshEventTopoSample: DemoSample = {
  id: 'dsh-event-topo',
  title: 'Event Topology',
  group: 'dsh',
  description: 'DeepSeek Harness turn flow: profile composition, plugin mounts, and agent-loop events.',
  document: dshEventTopoDocument,
}

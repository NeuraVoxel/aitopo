import { alarmSample } from './elements/alarm.ts'
import { codeAgentsSample } from './agents/code-agents.ts'
import { skillWorkflowSample } from './agents/skill-workflow.ts'
import { dshBootSample } from './dsh/boot.ts'
import { subagentSample } from './agents/subagent.ts'
import { edgeSample } from './elements/edge.ts'
import { groupSample } from './elements/group.ts'
import { nodeSample } from './elements/node.ts'
import { subnetworkSample } from './elements/subnetwork.ts'
import { businessPlaceholders } from './business/placeholders.ts'
import { dshEventTopoSample } from './dsh/event-topo.ts'
import { dshSessionSample } from './dsh/session.ts'
import { helloWorldSample } from './hello-world.ts'
import type { DemoSample } from './types.ts'

export type { DemoSample, DemoSampleGroupId } from './types.ts'

export const DEFAULT_SAMPLE_ID = 'hello-world'

const SAMPLES: readonly DemoSample[] = [
  helloWorldSample,
  nodeSample,
  edgeSample,
  groupSample,
  alarmSample,
  subnetworkSample,
  codeAgentsSample,
  subagentSample,
  skillWorkflowSample,
  dshBootSample,
  dshEventTopoSample,
  dshSessionSample,
  ...businessPlaceholders,
]

/** Ordered demo catalog: started, elements, agents, DSH, then business rows. */
export function listSamples(): readonly DemoSample[] {
  return SAMPLES
}

/** Lookup a sample by id. */
export function getSample(id: string): DemoSample | undefined {
  return SAMPLES.find(s => s.id === id)
}

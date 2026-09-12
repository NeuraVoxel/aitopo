import { alarmSample } from './elements/alarm.ts'
import { edgeSample } from './elements/edge.ts'
import { groupSample } from './elements/group.ts'
import { nodeSample } from './elements/node.ts'
import { subnetworkSample } from './elements/subnetwork.ts'
import { businessPlaceholders } from './business/placeholders.ts'
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
  ...businessPlaceholders,
]

/** Ordered demo catalog: getting-started, elements, then reserved business rows. */
export function listSamples(): readonly DemoSample[] {
  return SAMPLES
}

/** Lookup a sample by id. */
export function getSample(id: string): DemoSample | undefined {
  return SAMPLES.find(s => s.id === id)
}

import { businessPlaceholders } from './business/placeholders.ts'
import { helloWorldSample } from './hello-world.ts'
import type { DemoSample } from './types.ts'

export type { DemoSample, DemoSampleGroupId } from './types.ts'

export const DEFAULT_SAMPLE_ID = 'hello-world'

const SAMPLES: readonly DemoSample[] = [
  helloWorldSample,
  ...businessPlaceholders,
]

/** Ordered demo catalog (hello-world + business placeholders until element samples land). */
export function listSamples(): readonly DemoSample[] {
  return SAMPLES
}

/** Lookup a sample by id. */
export function getSample(id: string): DemoSample | undefined {
  return SAMPLES.find(s => s.id === id)
}

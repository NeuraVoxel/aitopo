import { adasAgentSample } from './agent.ts'
import { adasEgoSample } from './ego.ts'
import { adasFovSample } from './fov.ts'
import { adasMapSample } from './map.ts'
import { adasSensorSample } from './sensor.ts'
import { adasStaticSample } from './static.ts'
import { adasLaneSample } from './lane.ts'
import { adasOccupancyBevSample } from './occupancy-bev.ts'
import type { DemoSample } from '../types.ts'

const byId = new Map<string, DemoSample>([
  [adasEgoSample.id, adasEgoSample],
  [adasAgentSample.id, adasAgentSample],
  [adasStaticSample.id, adasStaticSample],
  [adasLaneSample.id, adasLaneSample],
  [adasMapSample.id, adasMapSample],
  [adasOccupancyBevSample.id, adasOccupancyBevSample],
  [adasFovSample.id, adasFovSample],
  [adasSensorSample.id, adasSensorSample],
])

/** Stable ADAS catalog order. */
const ADAS_ORDER: readonly string[] = [
  'adas-ego',
  'adas-agent',
  'adas-static',
  'adas-lane',
  'adas-map',
  'adas-occupancy-bev',
  'adas-fov',
  'adas-sensor',
]

/** Ordered ADAS demo samples for the catalog registry. */
export const adasSamples: readonly DemoSample[] = ADAS_ORDER.map(id => {
  const sample = byId.get(id)
  if (sample === undefined) {
    throw new Error(`ADAS catalog missing sample id: ${id}`)
  }
  return sample
})

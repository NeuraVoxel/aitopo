import { adasAgentSample } from './agent.ts'
import { adasEgoSample } from './ego.ts'
import { adasStaticSample } from './static.ts'
import { adasHdmapJunctionSample } from './hdmap-junction.ts'
import { adasLaneSample } from './lane.ts'
import { adasOccupancyBevSample } from './occupancy-bev.ts'
import { adasParkingSlotsSample } from './parking-slots.ts'
import { adasPlaceholders } from './placeholders.ts'
import { adasStopCrosswalkSample } from './stop-crosswalk.ts'
import { adasTrafficSignalsSample } from './traffic-signals.ts'
import type { DemoSample } from '../types.ts'

const byId = new Map<string, DemoSample>([
  [adasEgoSample.id, adasEgoSample],
  [adasAgentSample.id, adasAgentSample],
  [adasStaticSample.id, adasStaticSample],
  [adasLaneSample.id, adasLaneSample],
  [adasStopCrosswalkSample.id, adasStopCrosswalkSample],
  [adasTrafficSignalsSample.id, adasTrafficSignalsSample],
  [adasParkingSlotsSample.id, adasParkingSlotsSample],
  [adasOccupancyBevSample.id, adasOccupancyBevSample],
  [adasHdmapJunctionSample.id, adasHdmapJunctionSample],
  ...adasPlaceholders.map(s => [s.id, s] as const),
])

/** Stable ADAS catalog order (loadable + reserved interleaved by domain). */
const ADAS_ORDER: readonly string[] = [
  'adas-ego',
  'adas-agent',
  'adas-static',
  'adas-lane',
  'adas-stop-crosswalk',
  'adas-traffic-signals',
  'adas-parking-slots',
  'adas-sensor-fov',
  'adas-occupancy-bev',
  'adas-hdmap-junction',
]

/** Ordered ADAS demo samples for the catalog registry. */
export const adasSamples: readonly DemoSample[] = ADAS_ORDER.map(id => {
  const sample = byId.get(id)
  if (sample === undefined) {
    throw new Error(`ADAS catalog missing sample id: ${id}`)
  }
  return sample
})

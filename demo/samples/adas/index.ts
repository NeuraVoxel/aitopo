import { adasAgentSample } from './agent.ts'
import { adasDrivableAreaSample } from './drivable-area.ts'
import { adasEgoSample } from './ego.ts'
import { adasStaticSample } from './static.ts'
import { adasHdmapJunctionSample } from './hdmap-junction.ts'
import { adasLaneCenterlineSample } from './lane-centerline.ts'
import { adasLaneLinesSample } from './lane-lines.ts'
import { adasOccupancyBevSample } from './occupancy-bev.ts'
import { adasParkingSlotsSample } from './parking-slots.ts'
import { adasPerceptionBoxesSample } from './perception-boxes.ts'
import { adasPlaceholders } from './placeholders.ts'
import { adasPlanningPathSample } from './planning-path.ts'
import { adasPredictionSample } from './prediction.ts'
import { adasRoadBoundarySample } from './road-boundary.ts'
import { adasStopCrosswalkSample } from './stop-crosswalk.ts'
import { adasTrafficSignalsSample } from './traffic-signals.ts'
import { adasVruSample } from './vru.ts'
import type { DemoSample } from '../types.ts'

const byId = new Map<string, DemoSample>([
  [adasEgoSample.id, adasEgoSample],
  [adasAgentSample.id, adasAgentSample],
  [adasStaticSample.id, adasStaticSample],
  [adasLaneLinesSample.id, adasLaneLinesSample],
  [adasLaneCenterlineSample.id, adasLaneCenterlineSample],
  [adasRoadBoundarySample.id, adasRoadBoundarySample],
  [adasStopCrosswalkSample.id, adasStopCrosswalkSample],
  [adasDrivableAreaSample.id, adasDrivableAreaSample],
  [adasPerceptionBoxesSample.id, adasPerceptionBoxesSample],
  [adasVruSample.id, adasVruSample],
  [adasTrafficSignalsSample.id, adasTrafficSignalsSample],
  [adasParkingSlotsSample.id, adasParkingSlotsSample],
  [adasOccupancyBevSample.id, adasOccupancyBevSample],
  [adasPlanningPathSample.id, adasPlanningPathSample],
  [adasPredictionSample.id, adasPredictionSample],
  [adasHdmapJunctionSample.id, adasHdmapJunctionSample],
  ...adasPlaceholders.map(s => [s.id, s] as const),
])

/** Stable ADAS catalog order (loadable + reserved interleaved by domain). */
const ADAS_ORDER: readonly string[] = [
  'adas-ego',
  'adas-agent',
  'adas-static',
  'adas-lane-lines',
  'adas-lane-centerline',
  'adas-road-boundary',
  'adas-stop-crosswalk',
  'adas-drivable-area',
  'adas-perception-boxes',
  'adas-vru',
  'adas-traffic-signals',
  'adas-parking-slots',
  'adas-sensor-fov',
  'adas-occupancy-bev',
  'adas-planning-path',
  'adas-prediction',
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

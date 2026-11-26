import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/** Minimal parseable stub — reserved rows never load into Network. */
const emptyAdasStub: GraphDocument = {
  version: 1,
  meta: { title: 'ADAS reserved', kind: 'custom', domain: 'adas' },
  nodes: [],
  edges: [],
  groups: [],
}

function reservedAdas(
  id: string,
  title: string,
  description: string,
): DemoSample {
  return {
    id,
    title,
    group: 'adas',
    description,
    reserved: true,
    document: emptyAdasStub,
  }
}

/**
 * ADAS samples that need engine primitives aitopo does not ship yet
 * (sector / frustum FOV overlays). Ids stay stable for a later loadable flip.
 */
export const adasPlaceholders: DemoSample[] = [
  reservedAdas(
    'adas-sensor-fov',
    'Sensor FOV',
    'Unsupported: camera / lidar / radar FOV wedges. Needs sector / frustum overlay.',
  ),
]

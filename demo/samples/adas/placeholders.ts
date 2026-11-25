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
 * (freestanding path / wedge FOV / trajectory polylines without endpoints).
 * Ids stay stable for a later loadable flip.
 */
export const adasPlaceholders: DemoSample[] = [
  reservedAdas(
    'adas-lane-lines',
    'Lane lines',
    'Unsupported: freestanding lane markings. Needs path element (no GraphEdge from/to).',
  ),
  reservedAdas(
    'adas-lane-centerline',
    'Lane centerline',
    'Unsupported: freestanding center paths. Topology-only view lives in HD map junction.',
  ),
  reservedAdas(
    'adas-road-boundary',
    'Road boundary',
    'Unsupported: freestanding curb / road-edge polylines. Needs path element.',
  ),
  reservedAdas(
    'adas-sensor-fov',
    'Sensor FOV',
    'Unsupported: camera / lidar / radar FOV wedges. Needs sector / frustum overlay.',
  ),
  reservedAdas(
    'adas-planning-path',
    'Planning path',
    'Unsupported: ego planned trajectory polyline without endpoint Nodes.',
  ),
  reservedAdas(
    'adas-prediction',
    'Prediction',
    'Unsupported: multi-modal predicted trajectories as freestanding polylines.',
  ),
]

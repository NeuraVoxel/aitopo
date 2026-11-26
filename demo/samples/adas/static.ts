import type { GraphDocument, GraphNode } from '../../../src/protocol/types.ts'
import { ADAS_AGENT } from '../../lib/adas-theme.ts'
import type { DemoSample } from '../types.ts'
import { boxPx, egoAxleFrameNode } from './bev-scale.ts'
import { adasBox } from './shared.ts'

/**
 * Static objects around an axle-frame ego (no heading / speed).
 * Classes: CZone sign / Barrier / Traffic cone / Unclassified
 * (中文：施工区标志牌 / 护栏 / 交通锥 / 未分类).
 *
 * @see https://github.com/motional/nuplan-devkit (STATIC_OBJECT_TYPES)
 */

/** Representative static footprints in meters (length × width), BEV. */
const BOX_M = {
  czoneSign: { length: 0.5, width: 0.5 },
  barrier: { length: 2.5, width: 0.4 },
  trafficCone: { length: 0.4, width: 0.4 },
  unclassified: { length: 0.9, width: 0.9 },
} as const

type AgentPaint = { readonly fill: string; readonly stroke: string }

interface StaticSpec {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly label2: string
  readonly x: number
  readonly y: number
  readonly lengthM: number
  readonly widthM: number
  readonly paint: AgentPaint
  readonly trackedObjectType: string
}

function staticNodes(): GraphNode[] {
  // English = label (below); Chinese = label2 (above).
  const specs: readonly StaticSpec[] = [
    {
      id: 'czone-1',
      type: 'czone_sign',
      label: 'CZone sign',
      label2: '施工区标志牌',
      x: 120,
      y: 80,
      lengthM: BOX_M.czoneSign.length,
      widthM: BOX_M.czoneSign.width,
      paint: ADAS_AGENT.czoneSign,
      trackedObjectType: 'CZONE_SIGN',
    },
    {
      id: 'barrier-1',
      type: 'barrier',
      label: 'Barrier',
      label2: '护栏',
      x: 420,
      y: 160,
      lengthM: BOX_M.barrier.length,
      widthM: BOX_M.barrier.width,
      paint: ADAS_AGENT.barrier,
      trackedObjectType: 'BARRIER',
    },
    {
      id: 'cone-1',
      type: 'traffic_cone',
      label: 'Traffic cone',
      label2: '交通锥',
      x: 380,
      y: 70,
      lengthM: BOX_M.trafficCone.length,
      widthM: BOX_M.trafficCone.width,
      paint: ADAS_AGENT.trafficCone,
      trackedObjectType: 'TRAFFIC_CONE',
    },
    {
      id: 'unclassified-1',
      type: 'generic',
      label: 'Unclassified',
      label2: '未分类',
      x: 140,
      y: 320,
      lengthM: BOX_M.unclassified.length,
      widthM: BOX_M.unclassified.width,
      paint: ADAS_AGENT.generic,
      trackedObjectType: 'UNCLASSIFIED',
    },
  ]

  return specs.map(spec => {
    const { w, h } = boxPx(spec.lengthM, spec.widthM)
    return adasBox({
      id: spec.id,
      type: spec.type,
      label: spec.label,
      label2: spec.label2,
      x: spec.x,
      y: spec.y,
      w,
      h,
      fill: spec.paint.fill,
      stroke: spec.paint.stroke,
      data: {
        trackedObjectType: spec.trackedObjectType,
        agentKind: 'static',
        lengthM: spec.lengthM,
        widthM: spec.widthM,
      },
    })
  })
}

/** Static object catalog + axle-frame ego. */
export function buildAdasStaticDocument(): GraphDocument {
  return {
    version: 1,
    meta: { title: 'ADAS static', kind: 'custom', domain: 'adas' },
    nodes: [egoAxleFrameNode({ x: 260, y: 200 }), ...staticNodes()],
    edges: [],
    groups: [],
  }
}

export const adasStaticSample: DemoSample = {
  id: 'adas-static',
  title: 'Static',
  group: 'adas',
  description:
    'Static objects (CZone sign / Barrier / Traffic cone / Unclassified) around an axle-frame ego. Dynamic agents: see Agent demo.',
  get document() {
    return buildAdasStaticDocument()
  },
}

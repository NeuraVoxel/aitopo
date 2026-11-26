import type { GraphNode } from '../../../src/protocol/types.ts'
import { ADAS_AGENT, ADAS_BRAND } from '../../lib/adas-theme.ts'
import { DEMO_EGO_AXLE_FRAME_IMAGE } from '../../lib/vector-images.ts'

/** Rear-axle relative pivot — matches Ego demo heading / axle-frame. */
export const REAR_AXLE = { u: 0.5, v: 0.82 } as const
/** Pedestrian heading pivot (center; no rear axle). */
export const CENTER_PIVOT = { u: 0.5, v: 0.5 } as const

/**
 * Pacifica ego from nuplan `get_pacifica_parameters()`:
 * width = 1.1485*2, length = front_length + rear_length.
 */
export const EGO_WIDTH_M = 2.297
export const EGO_LENGTH_M = 5.176
/** Ego demo axle-frame height (length axis); sets the shared px/m scale. */
export const EGO_H = 80
export const EGO_W = Math.round(EGO_WIDTH_M * (EGO_H / EGO_LENGTH_M)) // ≈ 35
export const PX_PER_M = EGO_H / EGO_LENGTH_M

/** Floor so tiny classes (cone / ped) stay hittable and labeled. */
export const MIN_SIDE_PX = 16

/** BEV meters → node `w` (width) / `h` (length). */
export function boxPx(
  lengthM: number,
  widthM: number,
): { readonly w: number; readonly h: number } {
  return {
    w: Math.max(MIN_SIDE_PX, Math.round(widthM * PX_PER_M)),
    h: Math.max(MIN_SIDE_PX, Math.round(lengthM * PX_PER_M)),
  }
}

/** Shared axle-frame ego reference for Agent / Static demos. English label only. */
export function egoAxleFrameNode(opts?: {
  readonly x?: number
  readonly y?: number
}): GraphNode {
  const paint = ADAS_AGENT.ego
  return {
    id: 'ego',
    type: 'vehicle',
    label: 'Ego',
    status: 'active',
    x: opts?.x ?? 270,
    y: opts?.y ?? 200,
    w: EGO_W,
    h: EGO_H,
    angleAnchor: { ...REAR_AXLE },
    vectorImage: DEMO_EGO_AXLE_FRAME_IMAGE,
    data: {
      fill: paint.fill,
      stroke: paint.stroke,
      role: 'ego',
      axle: 'rear',
      // Longer than axle +x (36px) so the heading tip clears the frame.
      speedMs: 16,
      trackedObjectType: 'EGO',
      agentKind: 'ego',
      lengthM: EGO_LENGTH_M,
      widthM: EGO_WIDTH_M,
    },
    style: {
      showIcon: false,
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 10 },
    },
  }
}

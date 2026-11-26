import type { GraphShapeNode } from '../../../src/protocol/types.ts'
import { ADAS_BRAND } from '../../lib/adas-theme.ts'

/**
 * Screen degrees: 0 = +X (right), CCW; 90 = up (−Y). Matches BEV ego forward.
 * Sector = origin + arc samples (closed ShapeNode polygon).
 */
export function sectorPoints(
  origin: { readonly x: number; readonly y: number },
  radius: number,
  centerDeg: number,
  halfFovDeg: number,
  arcSteps: number,
): { readonly x: number; readonly y: number }[] {
  const start = ((centerDeg - halfFovDeg) * Math.PI) / 180
  const end = ((centerDeg + halfFovDeg) * Math.PI) / 180
  const points: { x: number; y: number }[] = [{ x: origin.x, y: origin.y }]
  for (let i = 0; i <= arcSteps; i++) {
    const t = start + ((end - start) * i) / arcSteps
    points.push({
      x: origin.x + radius * Math.cos(t),
      y: origin.y - radius * Math.sin(t),
    })
  }
  return points
}

/** Closed FOV wedge ShapeNode (ADAS sensor demos). */
export function fovWedge(args: {
  readonly id: string
  readonly label?: string
  readonly label2?: string
  readonly origin: { readonly x: number; readonly y: number }
  readonly radius: number
  readonly centerDeg: number
  readonly halfFovDeg: number
  readonly arcSteps?: number
  readonly fill: string
  readonly stroke: string
  readonly alpha: number
  readonly sensor: string
  readonly layerId?: string
  /** Usually the sensor mount node; cascades when ego moves. */
  readonly followHostId?: string
  readonly data?: Readonly<Record<string, unknown>>
}): GraphShapeNode {
  const arcSteps = args.arcSteps ?? Math.max(8, Math.round(args.halfFovDeg / 4))
  // Idle wedges stay faint; select/hover raise fill opacity + stroke so FOV pops.
  const hoverAlpha = Math.min(0.78, Math.max(0.52, args.alpha + 0.34))
  const selectAlpha = Math.min(0.92, Math.max(0.68, args.alpha + 0.48))
  return {
    id: args.id,
    ...(args.label !== undefined ? { label: args.label } : {}),
    ...(args.label2 !== undefined ? { label2: args.label2 } : {}),
    ...(args.followHostId !== undefined ? { followHostId: args.followHostId } : {}),
    points: sectorPoints(
      args.origin,
      args.radius,
      args.centerDeg,
      args.halfFovDeg,
      arcSteps,
    ),
    style: {
      fill: args.fill,
      stroke: args.stroke,
      lineWidth: 1.25,
      alpha: args.alpha,
      shapeKind: 'lineto',
      select: {
        color: args.stroke,
        width: 3.5,
        padding: 1,
        alpha: selectAlpha,
        glow: true,
        glowBlur: 18,
      },
      hover: {
        color: args.stroke,
        width: 2.75,
        padding: 1,
        alpha: hoverAlpha,
        glow: true,
        glowBlur: 14,
      },
      ...(args.label !== undefined
        ? {
            label: { color: ADAS_BRAND.navy, fontSize: 10, fontWeight: 'bold' as const },
            label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 9 },
          }
        : {}),
    },
    ...(args.layerId !== undefined ? { layerId: args.layerId } : {}),
    data: {
      role: 'sensor_fov',
      sensor: args.sensor,
      halfFovDeg: args.halfFovDeg,
      rangePx: args.radius,
      ...(args.data ?? {}),
    },
  }
}

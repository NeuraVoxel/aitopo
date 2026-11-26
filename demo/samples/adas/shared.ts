import type { GraphNode } from '../../../src/protocol/types.ts'
import { ADAS_BRAND } from '../../lib/adas-theme.ts'

/** Shared ADAS node chrome — engine body paint reads `data.fill` / `data.stroke`.
 * Callers must pass tokens from `demo/lib/adas-theme.ts` (nuBoard default / Foxglove).
 */
export function adasBox(opts: {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly label2?: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly fill: string
  readonly stroke: string
  readonly status?: GraphNode['status']
  readonly tooltip?: string
  readonly alarms?: GraphNode['alarms']
  readonly groupId?: string
  readonly data?: Readonly<Record<string, unknown>>
}): GraphNode {
  return {
    id: opts.id,
    type: opts.type,
    label: opts.label,
    ...(opts.label2 !== undefined ? { label2: opts.label2 } : {}),
    ...(opts.status !== undefined ? { status: opts.status } : {}),
    ...(opts.tooltip !== undefined ? { tooltip: opts.tooltip } : {}),
    ...(opts.alarms !== undefined ? { alarms: opts.alarms } : {}),
    ...(opts.groupId !== undefined ? { groupId: opts.groupId } : {}),
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    data: {
      fill: opts.fill,
      stroke: opts.stroke,
      ...(opts.data ?? {}),
    },
    style: {
      labelPosition: 'center',
      label: { color: ADAS_BRAND.navy, fontWeight: 'bold', fontSize: 11 },
      ...(opts.label2 !== undefined
        ? {
            label2Position: 'bottom' as const,
            label2: { color: ADAS_BRAND.mediumAsphalt, fontSize: 10 },
          }
        : {}),
      showIcon: false,
    },
  }
}

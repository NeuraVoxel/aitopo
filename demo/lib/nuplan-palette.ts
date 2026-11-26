/**
 * nuPlan / nuBoard visualization palette (motional/nuplan-devkit
 * `nuplan/planning/nuboard/style.py`). Default ADAS theme via `adas-theme.ts`.
 *
 * @see https://www.nuscenes.org/nuplan
 * @see https://github.com/motional/nuplan-devkit/blob/master/nuplan/planning/nuboard/style.py
 */

export interface NuplanPaint {
  readonly fill: string
  readonly stroke: string
}

/** Motional brand tokens from `MOTIONAL_PALETTE`. */
export const NUPLAN_MOTIONAL = {
  purple: '#5C48F6',
  hyundaiBlue: '#0A2972',
  navy: '#030A14',
  mediumAsphalt: '#828791',
  lightAsphalt: '#D2DCDC',
  darkAsphalt: '#40444A',
  solidAqua: '#00f6ff',
} as const

/** `simulation_tile_agent_style` — agents / ego boxes. */
export const NUPLAN_AGENT = {
  ego: { fill: '#FFFFFF', stroke: '#808080' } satisfies NuplanPaint,
  vehicle: { fill: '#84E573', stroke: '#84E573' } satisfies NuplanPaint,
  pedestrian: { fill: '#4D83E1', stroke: '#4D83E1' } satisfies NuplanPaint,
  bicycle: { fill: '#FF4D4D', stroke: '#FF4D4D' } satisfies NuplanPaint,
  generic: { fill: '#AE4DFF', stroke: '#AE4DFF' } satisfies NuplanPaint,
  trafficCone: { fill: '#FF9D4D', stroke: '#FF9D4D' } satisfies NuplanPaint,
  barrier: { fill: '#FFCC4D', stroke: '#FFCC4D' } satisfies NuplanPaint,
  czoneSign: { fill: '#00f6ff', stroke: '#00f6ff' } satisfies NuplanPaint,
} as const

/** `simulation_tile_trajectory_style` — planned / expert paths. */
export const NUPLAN_TRAJECTORY = {
  ego: '#00C8C8',
  expert: '#FA9600',
} as const

/** `simulation_map_layer_color` — HD map layers (fill + line). */
export const NUPLAN_MAP = {
  lane: { fill: '#4D6680', stroke: '#2d3ea7' } satisfies NuplanPaint,
  walkway: { fill: '#7e772e', stroke: '#7e772e' } satisfies NuplanPaint,
  carpark: { fill: '#ff7f00', stroke: '#ff7f00' } satisfies NuplanPaint,
  pudo: { fill: '#AF75A7', stroke: '#AF75A7' } satisfies NuplanPaint,
  intersection: { fill: '#7C8691', stroke: '#2d3ea7' } satisfies NuplanPaint,
  stopLine: { fill: '#FF0101', stroke: '#FF0101' } satisfies NuplanPaint,
  crosswalk: { fill: '#B5B5B5', stroke: '#B5B5B5' } satisfies NuplanPaint,
  roadblock: { fill: '#0000C0', stroke: '#0000C0' } satisfies NuplanPaint,
  baseline: '#CBCBCB',
  laneConnector: '#CBCBCB',
} as const

/** Tile chrome from `simulation_tile_style`. */
export const NUPLAN_TILE = {
  background: '#000000',
  missionGoal: '#00FF00',
} as const

/**
 * Demo-only aliases mapped onto nuBoard tokens (traffic phases / occupancy).
 * Prefer these over inventing new hex values in ADAS samples.
 */
export const NUPLAN_SIGNAL = {
  green: NUPLAN_AGENT.vehicle,
  amber: NUPLAN_AGENT.barrier,
  red: NUPLAN_MAP.stopLine,
} as const

export const NUPLAN_OCCUPANCY = {
  free: NUPLAN_MAP.lane,
  occupied: NUPLAN_MAP.stopLine,
  unknown: {
    fill: NUPLAN_MOTIONAL.mediumAsphalt,
    stroke: NUPLAN_MOTIONAL.darkAsphalt,
  } satisfies NuplanPaint,
} as const

/** Collect every `#RRGGBB` / `#RGB` token from the palette (for ADAS chrome gates). */
export function listNuplanPaletteHexes(): ReadonlySet<string> {
  const found = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^#[0-9a-fA-F]{3,8}$/.test(value)) found.add(value.toLowerCase())
      return
    }
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value as Record<string, unknown>)) walk(child)
    }
  }
  walk({
    NUPLAN_MOTIONAL,
    NUPLAN_AGENT,
    NUPLAN_TRAJECTORY,
    NUPLAN_MAP,
    NUPLAN_TILE,
    NUPLAN_SIGNAL,
    NUPLAN_OCCUPANCY,
  })
  return found
}

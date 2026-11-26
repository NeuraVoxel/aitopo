/**
 * Foxglove visualization palette — brand / product chrome from foxglove.dev
 * (violet blurple + dark studio neutrals) with ADAS semantic roles aligned to
 * the nuBoard token shape so themes can swap 1:1.
 *
 * @see https://foxglove.dev/product/visualization
 * @see https://foxglove.dev/blog/introducing-the-new-foxglove-brand
 */

export interface FoxglovePaint {
  readonly fill: string
  readonly stroke: string
}

/** Marketing / brand tokens scraped from foxglove.dev. */
export const FOXGLOVE_BRAND = {
  violet: '#a56eff',
  violetSoft: '#cdc2fb',
  ink: '#121619',
  slate: '#3c444a',
  mid: '#4d5358',
  muted: '#878d96',
  mist: '#c1c7cd',
  paper: '#f2f4f8',
  white: '#ffffff',
} as const

/** Agents / ego boxes (vivid on dark studio backgrounds). */
export const FOXGLOVE_AGENT = {
  ego: { fill: FOXGLOVE_BRAND.white, stroke: FOXGLOVE_BRAND.violet } satisfies FoxglovePaint,
  vehicle: { fill: '#29cc8a', stroke: '#29cc8a' } satisfies FoxglovePaint,
  pedestrian: { fill: '#4c9aff', stroke: '#4c9aff' } satisfies FoxglovePaint,
  bicycle: { fill: '#ff5c7a', stroke: '#ff5c7a' } satisfies FoxglovePaint,
  generic: { fill: FOXGLOVE_BRAND.violet, stroke: FOXGLOVE_BRAND.violet } satisfies FoxglovePaint,
  trafficCone: { fill: '#ff9f43', stroke: '#ff9f43' } satisfies FoxglovePaint,
  barrier: { fill: '#ffd166', stroke: '#ffd166' } satisfies FoxglovePaint,
  czoneSign: { fill: '#3fd0ff', stroke: '#3fd0ff' } satisfies FoxglovePaint,
} as const

/** Planned / expert paths. */
export const FOXGLOVE_TRAJECTORY = {
  ego: FOXGLOVE_BRAND.violet,
  expert: '#ff9f43',
} as const

/** HD map layers (fill + line). */
export const FOXGLOVE_MAP = {
  lane: { fill: FOXGLOVE_BRAND.slate, stroke: FOXGLOVE_BRAND.mist } satisfies FoxglovePaint,
  walkway: { fill: '#6b5f2a', stroke: '#6b5f2a' } satisfies FoxglovePaint,
  carpark: { fill: '#ff9f43', stroke: '#ff9f43' } satisfies FoxglovePaint,
  pudo: { fill: FOXGLOVE_BRAND.violetSoft, stroke: FOXGLOVE_BRAND.violet } satisfies FoxglovePaint,
  intersection: { fill: FOXGLOVE_BRAND.mid, stroke: FOXGLOVE_BRAND.muted } satisfies FoxglovePaint,
  stopLine: { fill: '#ff3b5c', stroke: '#ff3b5c' } satisfies FoxglovePaint,
  crosswalk: { fill: FOXGLOVE_BRAND.mist, stroke: FOXGLOVE_BRAND.mist } satisfies FoxglovePaint,
  roadblock: { fill: '#5b6cff', stroke: '#5b6cff' } satisfies FoxglovePaint,
  baseline: FOXGLOVE_BRAND.mist,
  laneConnector: FOXGLOVE_BRAND.muted,
} as const

/** Tile chrome. */
export const FOXGLOVE_TILE = {
  background: FOXGLOVE_BRAND.ink,
  missionGoal: '#29cc8a',
} as const

/** Demo aliases — traffic phases / occupancy. */
export const FOXGLOVE_SIGNAL = {
  green: FOXGLOVE_AGENT.vehicle,
  amber: FOXGLOVE_AGENT.barrier,
  red: FOXGLOVE_MAP.stopLine,
} as const

export const FOXGLOVE_OCCUPANCY = {
  free: FOXGLOVE_MAP.lane,
  occupied: FOXGLOVE_MAP.stopLine,
  unknown: {
    fill: FOXGLOVE_BRAND.muted,
    stroke: FOXGLOVE_BRAND.slate,
  } satisfies FoxglovePaint,
} as const

/** Collect every `#RRGGBB` / `#RGB` token from the palette (for ADAS chrome gates). */
export function listFoxglovePaletteHexes(): ReadonlySet<string> {
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
    FOXGLOVE_BRAND,
    FOXGLOVE_AGENT,
    FOXGLOVE_TRAJECTORY,
    FOXGLOVE_MAP,
    FOXGLOVE_TILE,
    FOXGLOVE_SIGNAL,
    FOXGLOVE_OCCUPANCY,
  })
  return found
}

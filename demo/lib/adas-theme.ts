/**
 * ADAS demo theme facade. Default is nuBoard; Foxglove / RViz are opt-in via
 * {@link setAdasTheme}. Samples and vector chrome read these getters so a
 * theme switch remount rebuilds documents with the active palette.
 */

import {
  FOXGLOVE_AGENT,
  FOXGLOVE_BRAND,
  FOXGLOVE_MAP,
  FOXGLOVE_OCCUPANCY,
  FOXGLOVE_SIGNAL,
  FOXGLOVE_TILE,
  FOXGLOVE_TRAJECTORY,
  listFoxglovePaletteHexes,
} from './foxglove-palette.ts'
import {
  NUPLAN_AGENT,
  NUPLAN_MAP,
  NUPLAN_MOTIONAL,
  NUPLAN_OCCUPANCY,
  NUPLAN_SIGNAL,
  NUPLAN_TILE,
  NUPLAN_TRAJECTORY,
  listNuplanPaletteHexes,
} from './nuplan-palette.ts'
import {
  RVIZ_AGENT,
  RVIZ_CHROME,
  RVIZ_MAP,
  RVIZ_OCCUPANCY,
  RVIZ_SIGNAL,
  RVIZ_TILE,
  RVIZ_TRAJECTORY,
  listRvizPaletteHexes,
} from './rviz-palette.ts'

export type AdasThemeId = 'nuboard' | 'foxglove' | 'rviz'

/** Catalog for the toolbar dropdown — append rows when adding themes. */
export const ADAS_THEME_OPTIONS: readonly { readonly id: AdasThemeId; readonly label: string }[] = [
  { id: 'nuboard', label: 'nuBoard' },
  { id: 'foxglove', label: 'Foxglove' },
  { id: 'rviz', label: 'RViz' },
] as const

const THEME_IDS: ReadonlySet<string> = new Set(ADAS_THEME_OPTIONS.map(option => option.id))

let currentTheme: AdasThemeId = 'nuboard'

/** Active ADAS theme id (default `nuboard`). */
export function getAdasTheme(): AdasThemeId {
  return currentTheme
}

/** True when `value` is a registered ADAS theme id. */
export function isAdasThemeId(value: string): value is AdasThemeId {
  return THEME_IDS.has(value)
}

/** Switch ADAS theme. Hosts remount the current sample after calling this. */
export function setAdasTheme(id: AdasThemeId): void {
  if (!isAdasThemeId(id)) {
    throw new Error(`Unknown ADAS theme: ${String(id)}`)
  }
  currentTheme = id
}

function pick<T>(nuboard: T, foxglove: T, rviz: T): T {
  if (currentTheme === 'foxglove') return foxglove
  if (currentTheme === 'rviz') return rviz
  return nuboard
}

/** Brand / asphalt neutrals (label ink, chrome). */
export const ADAS_BRAND = {
  get purple() {
    return pick(NUPLAN_MOTIONAL.purple, FOXGLOVE_BRAND.violet, RVIZ_CHROME.purple)
  },
  get navy() {
    return pick(NUPLAN_MOTIONAL.navy, FOXGLOVE_BRAND.ink, RVIZ_CHROME.black)
  },
  get mediumAsphalt() {
    return pick(NUPLAN_MOTIONAL.mediumAsphalt, FOXGLOVE_BRAND.muted, RVIZ_CHROME.midGray)
  },
  get lightAsphalt() {
    return pick(NUPLAN_MOTIONAL.lightAsphalt, FOXGLOVE_BRAND.mist, RVIZ_CHROME.silver)
  },
  get darkAsphalt() {
    return pick(NUPLAN_MOTIONAL.darkAsphalt, FOXGLOVE_BRAND.slate, RVIZ_CHROME.darkGray)
  },
  get solidAqua() {
    return pick(NUPLAN_MOTIONAL.solidAqua, FOXGLOVE_AGENT.czoneSign.fill, RVIZ_CHROME.cyan)
  },
} as const

/** Agents / ego boxes. */
export const ADAS_AGENT = {
  get ego() {
    return pick(NUPLAN_AGENT.ego, FOXGLOVE_AGENT.ego, RVIZ_AGENT.ego)
  },
  get vehicle() {
    return pick(NUPLAN_AGENT.vehicle, FOXGLOVE_AGENT.vehicle, RVIZ_AGENT.vehicle)
  },
  get pedestrian() {
    return pick(NUPLAN_AGENT.pedestrian, FOXGLOVE_AGENT.pedestrian, RVIZ_AGENT.pedestrian)
  },
  get bicycle() {
    return pick(NUPLAN_AGENT.bicycle, FOXGLOVE_AGENT.bicycle, RVIZ_AGENT.bicycle)
  },
  get generic() {
    return pick(NUPLAN_AGENT.generic, FOXGLOVE_AGENT.generic, RVIZ_AGENT.generic)
  },
  get trafficCone() {
    return pick(NUPLAN_AGENT.trafficCone, FOXGLOVE_AGENT.trafficCone, RVIZ_AGENT.trafficCone)
  },
  get barrier() {
    return pick(NUPLAN_AGENT.barrier, FOXGLOVE_AGENT.barrier, RVIZ_AGENT.barrier)
  },
  get czoneSign() {
    return pick(NUPLAN_AGENT.czoneSign, FOXGLOVE_AGENT.czoneSign, RVIZ_AGENT.czoneSign)
  },
} as const

/** Planned / expert paths. */
export const ADAS_TRAJECTORY = {
  get ego() {
    return pick(NUPLAN_TRAJECTORY.ego, FOXGLOVE_TRAJECTORY.ego, RVIZ_TRAJECTORY.ego)
  },
  get expert() {
    return pick(NUPLAN_TRAJECTORY.expert, FOXGLOVE_TRAJECTORY.expert, RVIZ_TRAJECTORY.expert)
  },
} as const

/** HD map layers. */
export const ADAS_MAP = {
  get lane() {
    return pick(NUPLAN_MAP.lane, FOXGLOVE_MAP.lane, RVIZ_MAP.lane)
  },
  get walkway() {
    return pick(NUPLAN_MAP.walkway, FOXGLOVE_MAP.walkway, RVIZ_MAP.walkway)
  },
  get carpark() {
    return pick(NUPLAN_MAP.carpark, FOXGLOVE_MAP.carpark, RVIZ_MAP.carpark)
  },
  get pudo() {
    return pick(NUPLAN_MAP.pudo, FOXGLOVE_MAP.pudo, RVIZ_MAP.pudo)
  },
  get intersection() {
    return pick(NUPLAN_MAP.intersection, FOXGLOVE_MAP.intersection, RVIZ_MAP.intersection)
  },
  get stopLine() {
    return pick(NUPLAN_MAP.stopLine, FOXGLOVE_MAP.stopLine, RVIZ_MAP.stopLine)
  },
  get crosswalk() {
    return pick(NUPLAN_MAP.crosswalk, FOXGLOVE_MAP.crosswalk, RVIZ_MAP.crosswalk)
  },
  get roadblock() {
    return pick(NUPLAN_MAP.roadblock, FOXGLOVE_MAP.roadblock, RVIZ_MAP.roadblock)
  },
  get baseline() {
    return pick(NUPLAN_MAP.baseline, FOXGLOVE_MAP.baseline, RVIZ_MAP.baseline)
  },
  get laneConnector() {
    return pick(NUPLAN_MAP.laneConnector, FOXGLOVE_MAP.laneConnector, RVIZ_MAP.laneConnector)
  },
} as const

/** Tile chrome. */
export const ADAS_TILE = {
  get background() {
    return pick(NUPLAN_TILE.background, FOXGLOVE_TILE.background, RVIZ_TILE.background)
  },
  get missionGoal() {
    return pick(NUPLAN_TILE.missionGoal, FOXGLOVE_TILE.missionGoal, RVIZ_TILE.missionGoal)
  },
} as const

/** Traffic-light phase aliases. */
export const ADAS_SIGNAL = {
  get green() {
    return pick(NUPLAN_SIGNAL.green, FOXGLOVE_SIGNAL.green, RVIZ_SIGNAL.green)
  },
  get amber() {
    return pick(NUPLAN_SIGNAL.amber, FOXGLOVE_SIGNAL.amber, RVIZ_SIGNAL.amber)
  },
  get red() {
    return pick(NUPLAN_SIGNAL.red, FOXGLOVE_SIGNAL.red, RVIZ_SIGNAL.red)
  },
} as const

/** Occupancy cell aliases. */
export const ADAS_OCCUPANCY = {
  get free() {
    return pick(NUPLAN_OCCUPANCY.free, FOXGLOVE_OCCUPANCY.free, RVIZ_OCCUPANCY.free)
  },
  get occupied() {
    return pick(NUPLAN_OCCUPANCY.occupied, FOXGLOVE_OCCUPANCY.occupied, RVIZ_OCCUPANCY.occupied)
  },
  get unknown() {
    return pick(NUPLAN_OCCUPANCY.unknown, FOXGLOVE_OCCUPANCY.unknown, RVIZ_OCCUPANCY.unknown)
  },
} as const

/** Union of registered theme hex tokens (ADAS sample chrome gate). */
export function listAdasThemeHexes(): ReadonlySet<string> {
  const merged = new Set<string>()
  for (const hex of listNuplanPaletteHexes()) merged.add(hex)
  for (const hex of listFoxglovePaletteHexes()) merged.add(hex)
  for (const hex of listRvizPaletteHexes()) merged.add(hex)
  return merged
}

/**
 * RViz visualization palette — classic ROS RViz defaults (background / grid /
 * map unknown) plus TF-style RGB and common marker hues, shaped like the
 * nuBoard / Foxglove ADAS token maps so themes swap 1:1.
 *
 * @see https://github.com/ros-visualization/rviz/blob/main/default.rviz
 * @see https://github.com/ros2/rviz/blob/rolling/rviz_default_plugins/src/rviz_default_plugins/displays/map/palette_builder.cpp
 */

export interface RvizPaint {
  readonly fill: string
  readonly stroke: string
}

/** Global Options + Grid + map-palette unknowns from default.rviz / MapDisplay. */
export const RVIZ_CHROME = {
  background: '#303030',
  grid: '#a0a0a4',
  unknown: '#708986',
  white: '#ffffff',
  black: '#000000',
  axisX: '#ff0000',
  axisY: '#00ff00',
  axisZ: '#0000ff',
  measure: '#808000',
  midGray: '#808080',
  darkGray: '#404040',
  silver: '#c0c0c0',
  orange: '#ff8000',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  purple: '#8000ff',
} as const

/** Agents / ego boxes (marker-style primaries on the dark RViz background). */
export const RVIZ_AGENT = {
  ego: { fill: RVIZ_CHROME.white, stroke: RVIZ_CHROME.grid } satisfies RvizPaint,
  vehicle: { fill: RVIZ_CHROME.axisY, stroke: RVIZ_CHROME.axisY } satisfies RvizPaint,
  pedestrian: { fill: RVIZ_CHROME.axisZ, stroke: RVIZ_CHROME.axisZ } satisfies RvizPaint,
  bicycle: { fill: RVIZ_CHROME.magenta, stroke: RVIZ_CHROME.magenta } satisfies RvizPaint,
  generic: { fill: RVIZ_CHROME.cyan, stroke: RVIZ_CHROME.cyan } satisfies RvizPaint,
  trafficCone: { fill: RVIZ_CHROME.orange, stroke: RVIZ_CHROME.orange } satisfies RvizPaint,
  barrier: { fill: RVIZ_CHROME.yellow, stroke: RVIZ_CHROME.yellow } satisfies RvizPaint,
  czoneSign: { fill: RVIZ_CHROME.cyan, stroke: RVIZ_CHROME.cyan } satisfies RvizPaint,
} as const

/** Planned / expert paths. */
export const RVIZ_TRAJECTORY = {
  ego: RVIZ_CHROME.cyan,
  expert: RVIZ_CHROME.orange,
} as const

/** HD map layers (grid / occupancy-map adjacent neutrals + stop red). */
export const RVIZ_MAP = {
  lane: { fill: RVIZ_CHROME.darkGray, stroke: RVIZ_CHROME.grid } satisfies RvizPaint,
  walkway: { fill: RVIZ_CHROME.unknown, stroke: RVIZ_CHROME.unknown } satisfies RvizPaint,
  carpark: { fill: RVIZ_CHROME.orange, stroke: RVIZ_CHROME.orange } satisfies RvizPaint,
  pudo: { fill: RVIZ_CHROME.purple, stroke: RVIZ_CHROME.purple } satisfies RvizPaint,
  intersection: { fill: RVIZ_CHROME.midGray, stroke: RVIZ_CHROME.grid } satisfies RvizPaint,
  stopLine: { fill: RVIZ_CHROME.axisX, stroke: RVIZ_CHROME.axisX } satisfies RvizPaint,
  crosswalk: { fill: RVIZ_CHROME.silver, stroke: RVIZ_CHROME.silver } satisfies RvizPaint,
  roadblock: { fill: RVIZ_CHROME.magenta, stroke: RVIZ_CHROME.magenta } satisfies RvizPaint,
  baseline: RVIZ_CHROME.grid,
  laneConnector: RVIZ_CHROME.midGray,
} as const

/** Tile chrome. */
export const RVIZ_TILE = {
  background: RVIZ_CHROME.background,
  missionGoal: RVIZ_CHROME.axisY,
} as const

/** Demo aliases — traffic phases / occupancy (map palette free→occupied). */
export const RVIZ_SIGNAL = {
  green: RVIZ_AGENT.vehicle,
  amber: RVIZ_AGENT.barrier,
  red: RVIZ_MAP.stopLine,
} as const

export const RVIZ_OCCUPANCY = {
  free: { fill: RVIZ_CHROME.silver, stroke: RVIZ_CHROME.grid } satisfies RvizPaint,
  occupied: { fill: RVIZ_CHROME.black, stroke: RVIZ_CHROME.axisX } satisfies RvizPaint,
  unknown: {
    fill: RVIZ_CHROME.unknown,
    stroke: RVIZ_CHROME.midGray,
  } satisfies RvizPaint,
} as const

/** Collect every `#RRGGBB` / `#RGB` token from the palette (for ADAS chrome gates). */
export function listRvizPaletteHexes(): ReadonlySet<string> {
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
    RVIZ_CHROME,
    RVIZ_AGENT,
    RVIZ_TRAJECTORY,
    RVIZ_MAP,
    RVIZ_TILE,
    RVIZ_SIGNAL,
    RVIZ_OCCUPANCY,
  })
  return found
}

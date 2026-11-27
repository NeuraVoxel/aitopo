/**
 * Debug overlay descriptors for element OBB / AABB strokes (twaver `_debug` idea).
 */

import type { Point, Rect } from '../geom.ts'

/** One oriented part (body or attachment) in unrotated host space. */
export interface DebugOrientedPart {
  readonly label: string
  readonly rect: Rect
}

/** One axis-aligned envelope in world space. */
export interface DebugAabbPart {
  readonly label: string
  readonly rect: Rect
}

/**
 * Per-element debug boxes: oriented parts (OBB when angled) + final AABB envelopes.
 */
export interface DebugElementBounds {
  readonly id: string
  readonly angle: number
  readonly pivot: Point
  readonly oriented: readonly DebugOrientedPart[]
  readonly aabbs: readonly DebugAabbPart[]
}

/** twaver-inspired stroke colors (clean-room). */
export const DEBUG_BOUNDS_COLORS = {
  bodyObb: 'rgba(249, 115, 22, 0.95)',
  attachmentObb: 'rgba(170, 171, 187, 0.95)',
  geometryAabb: 'rgba(34, 197, 94, 0.85)',
  paintAabb: 'rgba(6, 182, 212, 0.95)',
  dirtyAabb: 'rgba(239, 68, 68, 0.8)',
} as const

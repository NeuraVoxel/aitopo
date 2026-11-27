/**
 * Caps for dense multi-select UI (OCC-scale graphs).
 */

/**
 * When selected / mover count exceeds this, skip per-element selection rings and
 * live preview — use a union AABB overlay and batch commit instead.
 */
export const BULK_SELECTION_UI_CAP = 64

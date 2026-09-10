/**
 * Cached group band geometry for dirty-rect and paint.
 */

import type { Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { GroupPaintView } from '../render/canvas2d.ts'
import { groupBounds } from './bounds.ts'

/** Per-group View: invalidate → validate → paint DTO. */
export class GroupView {
  readonly id: string
  private dirty = true
  private cachedBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private active = false

  constructor(id: string) {
    this.id = id
  }

  get bounds(): Rect {
    return this.cachedBounds
  }

  get isActive(): boolean {
    return this.active
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute band bounds from the live scene when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const group = scene.groups.get(this.id)
    if (group === undefined) {
      this.active = false
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.dirty = false
      return
    }
    this.active = true
    this.cachedBounds = groupBounds(group)
    this.dirty = false
  }

  /** Build a paint DTO from cached bounds. */
  toPaintView(): GroupPaintView {
    return { bounds: this.cachedBounds }
  }
}

/**
 * Cached node geometry for dirty-rect and paint (selection/hover stay scene-owned).
 */

import type { Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { NodePaintView } from '../render/canvas2d.ts'
import { nodeBounds } from './bounds.ts'

/** Per-node View: invalidate → validate → paint DTO. */
export class NodeView {
  readonly id: string
  private dirty = true
  private cachedBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private active = false

  constructor(id: string) {
    this.id = id
  }

  /** World bounds after the last successful validate. */
  get bounds(): Rect {
    return this.cachedBounds
  }

  /** Whether the node exists in the scene after validate. */
  get isActive(): boolean {
    return this.active
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute bounds from the live scene when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const node = scene.nodes.get(this.id)
    if (node === undefined) {
      this.active = false
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.dirty = false
      return
    }
    this.active = true
    this.cachedBounds = nodeBounds(node)
    this.dirty = false
  }

  /**
   * Build a paint DTO; chrome flags come from the scene at paint time.
   * @param selected - selection chrome.
   * @param hovered - hover chrome.
   */
  toPaintView(selected: boolean, hovered: boolean): NodePaintView {
    return {
      bounds: this.cachedBounds,
      selected,
      hovered,
    }
  }
}

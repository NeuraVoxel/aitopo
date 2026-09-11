/**
 * Cached edge geometry for dirty-rect and paint.
 */

import type { Point, Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { EdgePaintView } from '../render/canvas2d.ts'
import { edgeAnchors } from './bounds.ts'

/** Per-edge View: invalidate → validate → paint DTO. */
export class EdgeView {
  readonly id: string
  private dirty = true
  private cachedBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private fromPt: Point = { x: 0, y: 0 }
  private toPt: Point = { x: 0, y: 0 }
  private orientation: 'horizontal' | 'vertical' = 'horizontal'
  private pointsCache: readonly Point[] = []
  private active = false

  constructor(id: string) {
    this.id = id
  }

  get bounds(): Rect {
    return this.cachedBounds
  }

  /** Validated orthogonal polyline including endpoints (paint + hit). */
  get points(): readonly Point[] {
    return this.pointsCache
  }

  get isActive(): boolean {
    return this.active
  }

  markDirty(): void {
    this.dirty = true
  }

  /**
   * Recompute route from endpoint nodes when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const edge = scene.edges.get(this.id)
    if (edge === undefined) {
      this.active = false
      this.dirty = false
      return
    }
    const from = scene.nodes.get(edge.from)
    const to = scene.nodes.get(edge.to)
    if (from === undefined || to === undefined) {
      this.active = false
      this.dirty = false
      return
    }
    const anchors = edgeAnchors(from, to, edge.waypoints)
    this.active = true
    this.fromPt = anchors.from
    this.toPt = anchors.to
    this.orientation = anchors.orientation
    this.pointsCache = anchors.points
    this.cachedBounds = anchors.bounds
    this.dirty = false
  }

  /**
   * Build a paint DTO; chrome flags come from the scene at paint time.
   * @param selected - selection chrome.
   * @param hovered - hover chrome.
   */
  toPaintView(selected: boolean, hovered: boolean): EdgePaintView {
    return {
      from: this.fromPt,
      to: this.toPt,
      selected,
      hovered,
      orientation: this.orientation,
      points: this.pointsCache,
    }
  }
}

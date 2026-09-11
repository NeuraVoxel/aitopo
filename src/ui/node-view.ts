/**
 * Cached node geometry and paint facets for dirty-rect / hit / paint.
 */

import type { Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type { NodePaintView } from '../render/canvas2d.ts'
import { nodeBounds } from './bounds.ts'

const ALARM_RADIUS = 6

/** Per-node View: invalidate → validate → paint DTO. */
export class NodeView {
  readonly id: string
  private dirty = true
  private cachedBounds: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private label = ''
  private meta: string | undefined
  private circular = false
  private alarm: NodePaintView['alarm']
  private active = false

  constructor(id: string) {
    this.id = id
  }

  /** World bounds after the last successful validate (also the node hit box). */
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
   * Recompute bounds and label/alarm facets from the live scene when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const node = scene.nodes.get(this.id)
    if (node === undefined) {
      this.active = false
      this.cachedBounds = { x: 0, y: 0, width: 0, height: 0 }
      this.label = ''
      this.meta = undefined
      this.circular = false
      this.alarm = undefined
      this.dirty = false
      return
    }
    this.active = true
    const bounds = nodeBounds(node)
    this.cachedBounds = bounds
    const data = node.data ?? {}
    this.circular = node.type === 'tool' || data.shape === 'circle'
    this.label = truncate(node.label, this.circular ? 8 : 18)
    if (this.circular) {
      this.meta = undefined
    } else if (node.status !== undefined || typeof data.meta === 'string') {
      const raw = typeof data.meta === 'string' ? data.meta : node.status!
      this.meta = truncate(raw, 18)
    } else {
      this.meta = undefined
    }
    const alarm = node.alarms?.find(a => a.level === 'error') ?? node.alarms?.[0]
    this.alarm = alarm === undefined
      ? undefined
      : {
          level: alarm.level,
          x: bounds.x + bounds.width - 10,
          y: bounds.y + 10,
          radius: ALARM_RADIUS,
        }
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
      label: this.label,
      circular: this.circular,
      ...(this.meta !== undefined ? { meta: this.meta } : {}),
      ...(this.alarm !== undefined ? { alarm: this.alarm } : {}),
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * Registry for transient overlay painters (marquee, ghosts, handles).
 */

import type { OverlayChrome } from '../interaction/types.ts'
import type { Renderer } from '../render/canvas2d.ts'

/**
 * Owns overlay chrome entries and notifies when membership changes.
 */
export class OverlayChromeRegistry {
  private readonly chrome: OverlayChrome[] = []

  /**
   * @param requestOverlayPaint - schedule an overlay-only frame.
   */
  constructor(private readonly requestOverlayPaint: () => void) {}

  /**
   * Register chrome; disposer removes it and requests overlay paint.
   * @param entry - painter invoked each overlay pass while registered.
   * @returns disposer.
   */
  add(entry: OverlayChrome): () => void {
    this.chrome.push(entry)
    this.requestOverlayPaint()
    return () => {
      const index = this.chrome.indexOf(entry)
      if (index >= 0) this.chrome.splice(index, 1)
      this.requestOverlayPaint()
    }
  }

  /**
   * Paint all registered chrome in registration order.
   * @param renderer - paint backend.
   */
  paintAll(renderer: Renderer): void {
    for (const entry of this.chrome) {
      entry.paint(renderer)
    }
  }
}

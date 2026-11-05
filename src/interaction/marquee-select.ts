/**
 * Shift or Ctrl/Cmd + empty-space drag: marquee select by node / group / edge bounds.
 */

import { containsRect, intersectsRect, type Point, type Rect } from '../geom.ts'
import { nodeBounds } from '../ui/bounds.ts'
import type { Interaction, InteractionHost } from './types.ts'

const DRAG_THRESHOLD_PX = 4

/** Normalize a drag start→current pair into a positive-size world rect. */
function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x, b.x) - x,
    height: Math.max(a.y, b.y) - y,
  }
}

/**
 * twaver DefaultInteraction: drag up-and-left → contain; otherwise intersect.
 * @param start - pointer-down world point.
 * @param end - pointer-up world point.
 */
function useIntersectMode(start: Point, end: Point): boolean {
  return !(start.x > end.x && start.y > end.y)
}

function matchesBand(band: Rect, target: Rect, intersect: boolean): boolean {
  return intersect ? intersectsRect(band, target) : containsRect(band, target)
}

/**
 * Marquee selection: Shift or Ctrl/Cmd + primary drag on empty space.
 * Unmodified empty drag stays with PanZoom. Locked elements may be selected.
 *
 * - Shift-only start → replace selection with matches.
 * - Ctrl/Cmd start (with or without Shift) → XOR matches into selection.
 */
export class MarqueeSelectInteraction implements Interaction {
  /**
   * Attach pointer listeners for marquee select.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    let active = false
    let dragged = false
    /** True when the gesture began with Ctrl/Cmd (XOR; do not clear first). */
    let xorMode = false
    let startClientX = 0
    let startClientY = 0
    let startWorld = { x: 0, y: 0 }
    /** Pointer id held via setPointerCapture; null when none. */
    let capturedPointerId: number | null = null
    let marquee: Rect | undefined
    let removeChrome: (() => void) | undefined

    const reset = (): void => {
      active = false
      dragged = false
      xorMode = false
      capturedPointerId = null
    }

    const releaseCapture = (): void => {
      if (capturedPointerId === null) return
      try {
        canvas.releasePointerCapture(capturedPointerId)
      } catch {
        // Pointer already released.
      }
      capturedPointerId = null
    }

    const clearMarquee = (): void => {
      marquee = undefined
      removeChrome?.()
      removeChrome = undefined
    }

    const showMarquee = (rect: Rect): void => {
      marquee = rect
      if (removeChrome === undefined) {
        removeChrome = network.addOverlayChrome({
          paint(renderer) {
            if (marquee !== undefined) renderer.drawMarquee(marquee)
          },
        })
      } else {
        network.requestOverlayPaint()
      }
    }

    const abort = (): void => {
      if (active) clearMarquee()
      releaseCapture()
      reset()
    }

    const collectHits = (band: Rect, intersect: boolean): string[] => {
      const ids: string[] = []
      for (const node of network.getNodes()) {
        if (matchesBand(band, nodeBounds(node), intersect)) ids.push(node.id)
      }
      for (const group of network.getGroups()) {
        const box = network.getGroupBandBounds(group.id)
        if (box !== undefined && matchesBand(band, box, intersect)) ids.push(group.id)
      }
      for (const edge of network.getEdges()) {
        const box = network.getEdgePathBounds(edge.id)
        if (box !== undefined && matchesBand(band, box, intersect)) ids.push(edge.id)
      }
      return ids
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const mod = event.shiftKey || event.ctrlKey || event.metaKey
      if (!mod) return
      // macOS Ctrl+click opens a context menu; keep Ctrl-marquee usable.
      if (event.ctrlKey) event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      if (network.hitTestScreen(screenX, screenY) !== undefined) return

      active = true
      dragged = false
      xorMode = event.ctrlKey || event.metaKey
      startClientX = event.clientX
      startClientY = event.clientY
      startWorld = network.screenToWorld(screenX, screenY)
    }

    const onContextMenu = (event: Event): void => {
      const mouse = event as MouseEvent
      if (mouse.ctrlKey) event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!active) return
      if (!dragged) {
        const dist = Math.hypot(event.clientX - startClientX, event.clientY - startClientY)
        if (dist < DRAG_THRESHOLD_PX) return
        dragged = true
        network.markGestureDragged()
        try {
          canvas.setPointerCapture(event.pointerId)
          capturedPointerId = event.pointerId
        } catch {
          // Capture unsupported or already held.
        }
      }
      const rect = canvas.getBoundingClientRect()
      const current = network.screenToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
      )
      showMarquee(rectFromPoints(startWorld, current))
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!active) return
      if (dragged) {
        const rect = canvas.getBoundingClientRect()
        const current = network.screenToWorld(
          event.clientX - rect.left,
          event.clientY - rect.top,
        )
        const band = rectFromPoints(startWorld, current)
        const intersect = useIntersectMode(startWorld, current)
        const hits = collectHits(band, intersect)
        if (xorMode) {
          const next = new Set(network.getSelectedIds())
          for (const id of hits) {
            if (next.has(id)) next.delete(id)
            else next.add(id)
          }
          network.setSelection([...next])
        } else {
          network.setSelection(hits)
        }
        releaseCapture()
      }
      clearMarquee()
      reset()
    }

    const onPointerCancel = (): void => {
      abort()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    canvas.addEventListener('contextmenu', onContextMenu)

    return () => {
      abort()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }
}

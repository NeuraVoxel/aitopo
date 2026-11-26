/**
 * Click-to-place control points; double-click or Enter commits a shape node.
 * Default commit is a closed lineto polygon (`closed: true`).
 */

import type { Interaction, InteractionHost } from './types.ts'

export interface CreateShapeNodeInteractionOptions {
  /**
   * Default `shapeKind` written on create. Omitted → `lineto`.
   */
  readonly shapeKind?: 'lineto' | 'quadto' | 'cubicto'
  /**
   * Whether the committed body closes to the first point. Omitted → `true`.
   */
  readonly closed?: boolean
}

/**
 * Exclusive create-shape-node mode: empty-canvas clicks append points; Esc cancels;
 * double-click or Enter commits when ≥2 points exist. Preview rubber-bands close
 * to the first point (polygon outline).
 */
export class CreateShapeNodeInteraction implements Interaction {
  private readonly shapeKind: 'lineto' | 'quadto' | 'cubicto'
  private readonly closed: boolean

  /**
   * @param options - optional default shape kind / closed flag.
   */
  constructor(options: CreateShapeNodeInteractionOptions = {}) {
    this.shapeKind = options.shapeKind ?? 'lineto'
    this.closed = options.closed !== false
  }

  /**
   * Attach pointer + keyboard listeners for shape-node create.
   * @param network - host network.
   * @returns disposer.
   */
  attach(network: InteractionHost): () => void {
    const canvas = network.getHitElement()
    if (canvas === null) return () => {}

    const view = network.getViewElement()
    const keyTarget: EventTarget = view
      ?? (typeof document !== 'undefined' ? document : new EventTarget())

    const points: Array<{ x: number; y: number }> = []
    let cursor: { x: number; y: number } | undefined
    let removeChrome: (() => void) | undefined
    const closed = this.closed
    const shapeKind = this.shapeKind

    const clearChrome = (): void => {
      removeChrome?.()
      removeChrome = undefined
    }

    const ensureChrome = (): void => {
      if (removeChrome !== undefined) {
        network.requestOverlayPaint()
        return
      }
      removeChrome = network.addOverlayChrome({
        paint(renderer) {
          if (points.length === 0) return
          for (let i = 0; i < points.length - 1; i += 1) {
            renderer.drawEdgeRubberBand(points[i]!, points[i + 1]!)
          }
          const last = points[points.length - 1]!
          const first = points[0]!
          if (cursor !== undefined) {
            renderer.drawEdgeRubberBand(last, cursor)
            if (closed && points.length >= 1) {
              renderer.drawEdgeRubberBand(cursor, first)
            }
          } else if (closed && points.length >= 2) {
            renderer.drawEdgeRubberBand(last, first)
          }
          const handleSize = 10 / network.viewport.state.zoom
          for (const point of points) {
            renderer.drawResizeHandle(point, handleSize)
          }
        },
      })
    }

    const reset = (): void => {
      points.length = 0
      cursor = undefined
      clearChrome()
    }

    const commit = (): void => {
      if (points.length < 2) return
      network.commitShapeNodeCreate({
        points: points.map(p => ({ x: p.x, y: p.y })),
        closed,
        style: { shapeKind },
      })
      reset()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const hit = network.hitTestScreen(event.clientX - rect.left, event.clientY - rect.top)
      // Only empty canvas appends; existing elements are left to other interactions.
      if (hit !== undefined) return
      const world = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      points.push({ x: world.x, y: world.y })
      cursor = { x: world.x, y: world.y }
      network.markGestureDragged()
      ensureChrome()
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (points.length === 0) return
      const rect = canvas.getBoundingClientRect()
      cursor = network.screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
      ensureChrome()
    }

    const onDblClick = (event: MouseEvent): void => {
      if (points.length === 0) return
      event.preventDefault()
      commit()
    }

    const onKeyDown = (event: Event): void => {
      const keyEvent = event as KeyboardEvent
      const el = keyEvent.target
      if (el !== null && typeof el === 'object' && 'tagName' in el) {
        const tag = String((el as { tagName: string }).tagName)
        const editable = 'isContentEditable' in el
          && (el as { isContentEditable: boolean }).isContentEditable === true
        if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return
      }
      if (keyEvent.key === 'Escape') {
        if (points.length === 0 && cursor === undefined) return
        keyEvent.preventDefault()
        reset()
        return
      }
      if (keyEvent.key === 'Enter') {
        if (points.length < 2) return
        keyEvent.preventDefault()
        commit()
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('dblclick', onDblClick)
    keyTarget.addEventListener('keydown', onKeyDown)
    if (view !== null && view.tabIndex < 0) {
      view.tabIndex = 0
    }

    return () => {
      reset()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('dblclick', onDblClick)
      keyTarget.removeEventListener('keydown', onKeyDown)
    }
  }
}

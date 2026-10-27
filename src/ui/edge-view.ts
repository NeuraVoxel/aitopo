/**
 * Cached edge geometry, attachments, and paint DTOs.
 */

import { growRect, unionRect, type Point, type Rect } from '../geom.ts'
import type { GraphScene } from '../model/scene.ts'
import type {
  GraphChromeStyle,
  GraphEdgeArrowStyle,
} from '../protocol/types.ts'
import type { EdgePaintView } from '../render/canvas2d.ts'
import {
  Attachment,
  EdgeAlarmAttachment,
  EdgeLabel2Attachment,
  EdgeLabelAttachment,
  EdgeTooltipAttachment,
  samplePolylineAt,
  type AttachmentPaintOp,
} from './attachment/index.ts'
import {
  edgeAnchors,
  edgeAnchorsFromRects,
  edgeEndpointsFromRects,
  unionPoint,
} from './bounds.ts'
import { resolveEdgeEndpoint } from './edge-endpoint.ts'
import {
  buildCircularArc,
  straightRoute,
  type CircularArcDraw,
} from './edge-route.ts'

const PATH_BOUNDS_PAD = 4
const DEFAULT_STROKE = '#5a6478'
const DEFAULT_STROKE_HOVER = '#3b82f6'
const DEFAULT_LINE_WIDTH = 1.25
const DEFAULT_ARROW_SIZE = 10

/** Per-edge View: invalidate → validate attachments → paint DTO. */
export class EdgeView {
  readonly id: string
  private dirty = true
  private path: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private union: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private fromPt: Point = { x: 0, y: 0 }
  private toPt: Point = { x: 0, y: 0 }
  private orientation: 'horizontal' | 'vertical' = 'horizontal'
  private pointsCache: readonly Point[] = []
  private arcDraw: CircularArcDraw | undefined
  private active = false
  private alpha = 1
  private stroke = DEFAULT_STROKE
  private strokeHover = DEFAULT_STROKE_HOVER
  private lineWidth = DEFAULT_LINE_WIDTH
  private strokeDash: readonly number[] | undefined
  private selectStyle: GraphChromeStyle | undefined
  private hoverStyle: GraphChromeStyle | undefined
  private arrowFrom = false
  private arrowTo = true
  private arrowStyle: GraphEdgeArrowStyle | undefined
  private attachments: Attachment[] = []
  private sceneOps: AttachmentPaintOp[] = []
  private overlayOps: AttachmentPaintOp[] = []

  constructor(id: string) {
    this.id = id
  }

  /** Union bounds (dirty); excludes hover-only tooltip. */
  get bounds(): Rect {
    return this.union
  }

  /** Polyline AABB (+ pad) for path hit / bend chrome. */
  get pathBounds(): Rect {
    return this.path
  }

  /** Alias for {@link bounds}. */
  get unionBounds(): Rect {
    return this.union
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
   * Recompute route, attachments, and dual bounds when dirty.
   * @param scene - active graph scene.
   */
  validate(scene: GraphScene): void {
    if (!this.dirty) return
    const edge = scene.edges.get(this.id)
    if (edge === undefined) {
      this.resetInactive()
      return
    }
    const fromEp = resolveEdgeEndpoint(scene, edge.from)
    const toEp = resolveEdgeEndpoint(scene, edge.to)
    if (fromEp === undefined || toEp === undefined) {
      this.resetInactive()
      return
    }
    // Intra-group member edge while collapsed: hide (agent links only cross the boundary).
    if (
      fromEp.kind === 'node'
      && toEp.kind === 'node'
      && fromEp.remappedGroupId !== undefined
      && fromEp.remappedGroupId === toEp.remappedGroupId
    ) {
      this.resetInactive()
      return
    }
    const fromBox = fromEp.box
    const toBox = toEp.box
    const hints = {
      from: edge.fromAnchor,
      to: edge.toAnchor,
      fromOutset: edge.fromOutset,
      toOutset: edge.toOutset,
    }
    const route = edge.style?.route ?? 'orthogonal'
    let fromPt: Point
    let toPt: Point
    let orientation: 'horizontal' | 'vertical'
    let points: readonly Point[]
    this.arcDraw = undefined
    if (route === 'arc' || route === 'straight') {
      const ends = edgeEndpointsFromRects(fromBox, toBox, hints)
      orientation = ends.orientation
      if (route === 'straight') {
        fromPt = ends.from
        toPt = ends.to
        points = straightRoute(fromPt, toPt)
      } else {
        const center = edge.style?.arcCenter
        if (center === undefined) {
          throw new Error(`edge "${edge.id}": style.route "arc" requires style.arcCenter`)
        }
        const built = buildCircularArc(
          center,
          ends.from,
          ends.to,
          edge.style?.arcClockwise !== false,
          edge.style?.arcRadius,
        )
        points = built.points
        this.arcDraw = built.draw
        fromPt = points[0]!
        toPt = points[points.length - 1]!
      }
    } else {
      // Remapped member penetration: ignore authored waypoints so the path
      // follows the live collapsed band. Explicit group endpoints keep bends.
      const remapped = (fromEp.kind === 'node' && fromEp.remappedGroupId !== undefined)
        || (toEp.kind === 'node' && toEp.remappedGroupId !== undefined)
      const usesBoxRoute = fromEp.kind === 'group'
        || toEp.kind === 'group'
        || remapped
      const waypoints = remapped ? undefined : edge.waypoints
      if (usesBoxRoute) {
        const anchors = edgeAnchorsFromRects(fromBox, toBox, waypoints, hints)
        fromPt = anchors.from
        toPt = anchors.to
        orientation = anchors.orientation
        points = anchors.points
      } else {
        const fromNode = scene.nodes.get(edge.from)!
        const toNode = scene.nodes.get(edge.to)!
        const anchors = edgeAnchors(fromNode, toNode, waypoints, hints)
        fromPt = anchors.from
        toPt = anchors.to
        orientation = anchors.orientation
        points = anchors.points
      }
    }
    this.active = true
    this.fromPt = fromPt
    this.toPt = toPt
    this.orientation = orientation
    this.pointsCache = points
    let pathBounds: Rect | undefined
    for (const point of points) {
      pathBounds = unionPoint(pathBounds, point)
    }
    this.path = growRect(
      pathBounds ?? { x: fromPt.x, y: fromPt.y, width: 1, height: 1 },
      PATH_BOUNDS_PAD,
    )
    const style = edge.style
    this.alpha = clampAlpha(style?.alpha)
    this.stroke = style?.stroke ?? DEFAULT_STROKE
    this.strokeHover = style?.strokeHover ?? DEFAULT_STROKE_HOVER
    this.lineWidth = style?.lineWidth ?? DEFAULT_LINE_WIDTH
    this.strokeDash = style?.strokeDash
    this.selectStyle = style?.select
    this.hoverStyle = style?.hover
    this.arrowFrom = style?.arrowFrom === true
    this.arrowTo = style?.arrowTo !== false
    this.arrowStyle = style?.arrow
    this.attachments = syncAttachments(edge, this.attachments)
    const ctx = { edge, points: this.pointsCache }
    let union: Rect | undefined = this.path
    for (const attachment of this.attachments) {
      attachment.validate(ctx)
      if (attachment.contributesToUnion()) {
        union = unionRect(union, attachment.bounds)
      }
    }
    this.union = union ?? this.path
    this.dirty = false
  }

  /**
   * Build a paint DTO; chrome flags and hover tooltip depend on selection/hover.
   * @param selected - selection chrome.
   * @param hovered - hover chrome / tooltip.
   */
  toPaintView(selected: boolean, hovered: boolean): EdgePaintView {
    this.sceneOps = []
    this.overlayOps = []
    for (const attachment of this.attachments) {
      const op = attachment.toPaintOp(hovered)
      if (op === undefined) continue
      if (op.layer === 'overlay') this.overlayOps.push(op)
      else this.sceneOps.push(op)
    }

    let resolvedStroke = this.stroke
    let paintWidth = this.lineWidth
    if (hovered) {
      resolvedStroke = this.hoverStyle?.color ?? this.strokeHover
      paintWidth = Math.max(this.lineWidth, this.hoverStyle?.width ?? 2.5)
    } else if (selected) {
      resolvedStroke = this.selectStyle?.color ?? this.strokeHover
      paintWidth = Math.max(this.lineWidth, this.selectStyle?.width ?? 2.5)
    }

    const arrowSize = this.arrowStyle?.size ?? DEFAULT_ARROW_SIZE
    const arrowFill = this.arrowStyle?.fill ?? resolvedStroke
    const arrowStroke = this.arrowStyle?.stroke ?? resolvedStroke
    const fromSample = samplePolylineAt(this.pointsCache, 0)
    const toSample = samplePolylineAt(this.pointsCache, 1)

    return {
      from: this.fromPt,
      to: this.toPt,
      pathBounds: this.path,
      unionBounds: this.union,
      selected,
      hovered,
      orientation: this.orientation,
      points: this.pointsCache,
      ...(this.arcDraw !== undefined ? { arc: this.arcDraw } : {}),
      alpha: this.alpha,
      stroke: resolvedStroke,
      lineWidth: paintWidth,
      ...(this.strokeDash !== undefined ? { strokeDash: this.strokeDash } : {}),
      ...(this.arrowFrom
        ? {
          arrowFrom: {
            tip: fromSample.point,
            direction: { x: -fromSample.tangent.x, y: -fromSample.tangent.y },
            size: arrowSize,
            fill: arrowFill,
            stroke: arrowStroke,
          },
        }
        : {}),
      ...(this.arrowTo
        ? {
          arrowTo: {
            tip: toSample.point,
            direction: { ...toSample.tangent },
            size: arrowSize,
            fill: arrowFill,
            stroke: arrowStroke,
          },
        }
        : {}),
      attachments: this.sceneOps,
      overlayAttachments: this.overlayOps,
    }
  }

  private resetInactive(): void {
    this.active = false
    this.path = { x: 0, y: 0, width: 0, height: 0 }
    this.union = this.path
    this.pointsCache = []
    this.arcDraw = undefined
    this.alpha = 1
    this.stroke = DEFAULT_STROKE
    this.strokeHover = DEFAULT_STROKE_HOVER
    this.lineWidth = DEFAULT_LINE_WIDTH
    this.strokeDash = undefined
    this.selectStyle = undefined
    this.hoverStyle = undefined
    this.arrowFrom = false
    this.arrowTo = true
    this.arrowStyle = undefined
    this.attachments = []
    this.sceneOps = []
    this.overlayOps = []
    this.dirty = false
  }
}

/** Clamp style.alpha into `[0, 1]`; omitted → opaque. */
function clampAlpha(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function syncAttachments(
  edge: import('../protocol/types.ts').GraphEdge,
  previous: Attachment[],
): Attachment[] {
  const next: Attachment[] = []
  if (edge.label !== undefined && edge.label.length > 0) {
    next.push(takeOrCreate(previous, EdgeLabelAttachment, () => new EdgeLabelAttachment()))
  }
  if (edge.label2 !== undefined && edge.label2.length > 0) {
    next.push(takeOrCreate(previous, EdgeLabel2Attachment, () => new EdgeLabel2Attachment()))
  }
  if (edge.alarms !== undefined && edge.alarms.length > 0) {
    next.push(takeOrCreate(previous, EdgeAlarmAttachment, () => new EdgeAlarmAttachment()))
  }
  if (edge.tooltip !== undefined && edge.tooltip.length > 0) {
    next.push(takeOrCreate(previous, EdgeTooltipAttachment, () => new EdgeTooltipAttachment()))
  }
  return next
}

function takeOrCreate<T extends Attachment>(
  previous: Attachment[],
  ctor: abstract new (...args: never[]) => T,
  create: () => T,
): T {
  const found = previous.find((a): a is T => a instanceof ctor)
  return found ?? create()
}

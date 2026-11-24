/**
 * View helpers: bounds and hit-testing derived from scene elements.
 */

import { distanceToPolyline, hitRect, type Point, type Rect } from '../geom.ts'
import type { GraphEdge, GraphGroup, GraphNode } from '../protocol/types.ts'

/** Default node body size — matches twaver `Defaults.NODE_WIDTH` / `NODE_HEIGHT`. */
const DEFAULT_W = 50
/** Default node body size — matches twaver `Defaults.NODE_HEIGHT`. */
const DEFAULT_H = 50

/**
 * World bounds for a node (defaults when x/y/w/h missing).
 * @param node - graph node.
 */
export function nodeBounds(node: GraphNode): Rect {
  return {
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.w ?? DEFAULT_W,
    height: node.h ?? DEFAULT_H,
  }
}

/**
 * World bounds for a group body.
 * Collapsed (and expanded + `autoFit: false`) use document `x/y/w/h`.
 * Omitted `w`/`h` → **50×50** (twaver `NODE_WIDTH` / `NODE_HEIGHT`; Group is a Node).
 * @param group - graph group.
 */
export function groupBounds(group: GraphGroup): Rect {
  return {
    x: group.x ?? 0,
    y: group.y ?? 0,
    width: group.w ?? DEFAULT_W,
    height: group.h ?? DEFAULT_H,
  }
}

/**
 * Explicit endpoint override. Omitted → auto from relative box position.
 * Corners pin the box corner (twaver `link.from.position` / `bottomright` idea).
 * `radial` — ray from own center toward peer, exit on own AABB (ring spokes).
 */
export type EdgeAnchorSide =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'radial'

/** Non-radial pins used for orthogonal leave/arrive. */
export type OrthogonalAnchorSide = Exclude<EdgeAnchorSide, 'radial'>

/** Per-edge anchor side hints (GraphEdge `fromAnchor` / `toAnchor`). */
export interface EdgeAnchorHints {
  readonly from?: EdgeAnchorSide | undefined
  readonly to?: EdgeAnchorSide | undefined
  /** Outward nudge for a radial `from` (toward peer), world px. */
  readonly fromOutset?: number
  /** Outward nudge for a radial `to` (toward peer), world px. */
  readonly toOutset?: number
}

export function anchorPoint(side: OrthogonalAnchorSide, box: Rect): Point {
  const right = box.x + box.width
  const bottom = box.y + box.height
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  switch (side) {
    case 'top': return { x: cx, y: box.y }
    case 'bottom': return { x: cx, y: bottom }
    case 'left': return { x: box.x, y: cy }
    case 'right': return { x: right, y: cy }
    case 'topLeft': return { x: box.x, y: box.y }
    case 'topRight': return { x: right, y: box.y }
    case 'bottomLeft': return { x: box.x, y: bottom }
    case 'bottomRight': return { x: right, y: bottom }
  }
}

function rectCenter(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * First exit of the ray `from → toward` through `box` (expects `from` inside or on box).
 */
export function rayRectExit(box: Rect, from: Point, toward: Point): Point | undefined {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return undefined
  let bestT = Infinity
  let hit: Point | undefined
  const candidates: Array<readonly [number, number, number]> = []
  if (Math.abs(dx) > 1e-9) {
    const tL = (box.x - from.x) / dx
    candidates.push([box.x, from.y + tL * dy, tL])
    const tR = (box.x + box.width - from.x) / dx
    candidates.push([box.x + box.width, from.y + tR * dy, tR])
  }
  if (Math.abs(dy) > 1e-9) {
    const tT = (box.y - from.y) / dy
    candidates.push([from.x + tT * dx, box.y, tT])
    const tB = (box.y + box.height - from.y) / dy
    candidates.push([from.x + tB * dx, box.y + box.height, tB])
  }
  for (const [x, y, t] of candidates) {
    if (!(t > 1e-9) || t === Infinity) continue
    if (x < box.x - 1e-6 || x > box.x + box.width + 1e-6) continue
    if (y < box.y - 1e-6 || y > box.y + box.height + 1e-6) continue
    if (t < bestT) {
      bestT = t
      hit = { x, y }
    }
  }
  return hit
}

/**
 * Port on `own` facing `peer`: center→peer ray exit, optional outward outset.
 */
export function radialAnchor(own: Rect, peer: Rect, outset = 0): Point {
  const a = rectCenter(own)
  const b = rectCenter(peer)
  const hit = rayRectExit(own, a, b) ?? a
  if (outset === 0) return hit
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: hit.x + (dx / len) * outset, y: hit.y + (dy / len) * outset }
}

function resolveAnchor(
  side: EdgeAnchorSide | undefined,
  own: Rect,
  peer: Rect,
  auto: Point,
  outset: number,
): Point {
  if (side === undefined) return auto
  if (side === 'radial') return radialAnchor(own, peer, outset)
  return anchorPoint(side, own)
}

/**
 * Resolve endpoint anchors without building a route (for `straight` / `arc`).
 */
export function edgeEndpointsFromRects(
  fromBox: Rect,
  toBox: Rect,
  hints?: EdgeAnchorHints,
): { from: Point; to: Point; orientation: 'horizontal' | 'vertical' } {
  const auto = edgeAnchorsAutoFromRects(fromBox, toBox)
  return {
    from: resolveAnchor(hints?.from, fromBox, toBox, auto.from, hints?.fromOutset ?? 0),
    to: resolveAnchor(hints?.to, toBox, fromBox, auto.to, hints?.toOutset ?? 0),
    orientation: auto.orientation,
  }
}

/**
 * Edge endpoint anchors and route points (twaver Link orthogonal/flexional ideas).
 * Prefer left↔right when boxes sit side-by-side (Model → Tools fan-out), then
 * top↔bottom for stacked bands (Join → next Step).
 * When `waypoints` is non-empty, polyline is `[fromAnchor, ...waypoints, toAnchor]`.
 * Anchor `hints` pin the endpoint sides over the relative-position heuristic.
 * @param from - source node.
 * @param to - target node.
 * @param waypoints - optional intermediate bend points.
 * @param hints - optional explicit endpoint sides.
 */
export function edgeAnchors(
  from: GraphNode,
  to: GraphNode,
  waypoints?: readonly { readonly x: number; readonly y: number }[],
  hints?: EdgeAnchorHints,
): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
  /** Polyline points including endpoints (orthogonal.H.V / V.H style). */
  points: readonly Point[]
} {
  return edgeAnchorsFromRects(nodeBounds(from), nodeBounds(to), waypoints, hints)
}

/**
 * Orthogonal route between two world boxes (nodes or collapsed group bands).
 * @param fromBox - source AABB.
 * @param toBox - target AABB.
 * @param waypoints - optional intermediate bend points.
 * @param hints - optional explicit endpoint sides.
 */
export function edgeAnchorsFromRects(
  fromBox: Rect,
  toBox: Rect,
  waypoints?: readonly { readonly x: number; readonly y: number }[],
  hints?: EdgeAnchorHints,
): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
  points: readonly Point[]
} {
  const auto = edgeAnchorsAutoFromRects(fromBox, toBox)
  if (waypoints === undefined || waypoints.length === 0) {
    if (hints?.from === undefined && hints?.to === undefined) return auto
  }
  // Radial anchors are for straight/arc routes; orthogonal corridors keep side pins.
  if (hints?.from === 'radial' || hints?.to === 'radial') {
    const ends = edgeEndpointsFromRects(fromBox, toBox, hints)
    return {
      from: ends.from,
      to: ends.to,
      bounds: unionPoint(unionPoint(undefined, ends.from), ends.to),
      orientation: ends.orientation,
      points: [ends.from, ends.to],
    }
  }
  const fromSide = hints?.from !== undefined && hints.from !== 'radial' ? hints.from : undefined
  const toSide = hints?.to !== undefined && hints.to !== 'radial' ? hints.to : undefined
  const fromPt = fromSide === undefined ? auto.from : anchorPoint(fromSide, fromBox)
  const toPt = toSide === undefined ? auto.to : anchorPoint(toSide, toBox)
  const fromVertical = fromSide !== undefined && isVerticalSide(fromSide)
  const toVertical = toSide !== undefined && isVerticalSide(toSide)
  const orientation: 'horizontal' | 'vertical' = fromSide === undefined && toSide === undefined
    ? auto.orientation
    : fromVertical || (!toVertical && auto.orientation === 'vertical')
      ? 'vertical'
      : 'horizontal'
  // Complementary sides (e.g. bottom→right): one elbow = two segments, not a mid Z.
  const elbow = fromSide !== undefined && toSide !== undefined
    ? complementaryElbow(fromPt, toPt, fromSide, toSide)
    : undefined
  let points: Point[]
  if (elbow !== undefined) {
    // Prefer relative corner semantics over stale absolute waypoints (esp. after
    // collapse remap moves the to-box onto a group card).
    points = elbow
  } else if (waypoints !== undefined && waypoints.length > 0) {
    points = [
      fromPt,
      ...waypoints.map(p => ({ x: p.x, y: p.y })),
      toPt,
    ]
  } else {
    const mid = orientation === 'vertical'
      ? orthogonalVH(fromPt, toPt)
      : orthogonalHV(fromPt, toPt)
    points = [fromPt, ...mid.slice(1, -1), toPt]
  }
  // Keep corridor waypoints, but force every segment axis-aligned (insert elbows
  // when collapse remapping or authoring leaves a diagonal).
  points = orthogonalizePolyline(points)
  let bounds: Rect | undefined
  for (const point of points) {
    bounds = unionPoint(bounds, point)
  }
  return {
    from: fromPt,
    to: toPt,
    bounds: bounds ?? { x: fromPt.x, y: fromPt.y, width: 1, height: 1 },
    orientation,
    points,
  }
}

/**
 * Auto orthogonal route from node boxes (no custom waypoints).
 * @param from - source node.
 * @param to - target node.
 */
export function edgeAnchorsAuto(from: GraphNode, to: GraphNode): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
  points: readonly Point[]
} {
  return edgeAnchorsAutoFromRects(nodeBounds(from), nodeBounds(to))
}

/**
 * Auto orthogonal route from two AABBs (no custom waypoints).
 * @param a - source box.
 * @param b - target box.
 */
export function edgeAnchorsAutoFromRects(a: Rect, b: Rect): {
  from: Point
  to: Point
  bounds: Rect
  orientation: 'horizontal' | 'vertical'
  points: readonly Point[]
} {
  const acx = a.x + a.width / 2
  const acy = a.y + a.height / 2
  const bcx = b.x + b.width / 2
  const bcy = b.y + b.height / 2
  const aRight = a.x + a.width
  const aBottom = a.y + a.height
  const bRight = b.x + b.width
  const bBottom = b.y + b.height

  let fromPt: Point
  let toPt: Point
  let orientation: 'horizontal' | 'vertical'
  let points: Point[]

  // Right-side fan-out (Model → Tools) before vertical bands; vertical
  // before leftward (Join → next Step which sits below-left).
  if (b.x >= aRight - 1) {
    orientation = 'horizontal'
    fromPt = { x: aRight, y: acy }
    toPt = { x: b.x, y: bcy }
    points = orthogonalHV(fromPt, toPt)
  } else if (b.y >= aBottom - 1) {
    orientation = 'vertical'
    fromPt = { x: acx, y: aBottom }
    toPt = { x: bcx, y: b.y }
    points = orthogonalVH(fromPt, toPt)
  } else if (a.y >= bBottom - 1) {
    orientation = 'vertical'
    fromPt = { x: acx, y: a.y }
    toPt = { x: bcx, y: bBottom }
    points = orthogonalVH(fromPt, toPt)
  } else if (a.x >= bRight - 1) {
    orientation = 'horizontal'
    fromPt = { x: a.x, y: acy }
    toPt = { x: bRight, y: bcy }
    points = orthogonalHV(fromPt, toPt)
  } else {
    const dx = bcx - acx
    const dy = bcy - acy
    if (Math.abs(dx) >= Math.abs(dy)) {
      orientation = 'horizontal'
      if (dx >= 0) {
        fromPt = { x: aRight, y: acy }
        toPt = { x: b.x, y: bcy }
      } else {
        fromPt = { x: a.x, y: acy }
        toPt = { x: bRight, y: bcy }
      }
      points = orthogonalHV(fromPt, toPt)
    } else {
      orientation = 'vertical'
      if (dy >= 0) {
        fromPt = { x: acx, y: aBottom }
        toPt = { x: bcx, y: b.y }
      } else {
        fromPt = { x: acx, y: a.y }
        toPt = { x: bcx, y: bBottom }
      }
      points = orthogonalVH(fromPt, toPt)
    }
  }

  let bounds: Rect | undefined
  for (const point of points) {
    bounds = unionPoint(bounds, point)
  }
  return {
    from: fromPt,
    to: toPt,
    bounds: bounds ?? { x: fromPt.x, y: fromPt.y, width: 1, height: 1 },
    orientation,
    points,
  }
}

/** Horizontal-then-vertical orthogonal: leave X, travel Y, enter X (H.V). */
export function orthogonalHV(from: Point, to: Point): Point[] {
  if (Math.abs(from.y - to.y) < 0.5) return [from, to]
  const midX = (from.x + to.x) / 2
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]
}

/** Vertical-then-horizontal orthogonal: leave Y, travel X, enter Y (V.H). */
export function orthogonalVH(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) < 0.5) return [from, to]
  const midY = (from.y + to.y) / 2
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to]
}

const AXIS_EPS = 0.5

/**
 * Top/bottom edges and the four box corners leave/arrive primarily on ±Y.
 * Corners still pin the geometric corner; only the corridor axis is vertical.
 */
export function isVerticalSide(side: OrthogonalAnchorSide): boolean {
  return side === 'top'
    || side === 'bottom'
    || side === 'topLeft'
    || side === 'topRight'
    || side === 'bottomLeft'
    || side === 'bottomRight'
}

/** Left/right edge midpoints leave/arrive on ±X. */
export function isHorizontalSide(side: OrthogonalAnchorSide): boolean {
  return side === 'left' || side === 'right'
}

/**
 * Minimal orthogonal path for complementary leave/arrive sides
 * (vertical leave + horizontal arrive, or the reverse): one corner, two segments.
 * Parallel sides return undefined so callers keep the mid Z (H.V / V.H).
 * Corner pins (`bottomRight` etc.) count as vertical leave/arrive.
 * @param from - pinned leave point.
 * @param to - pinned arrive point.
 * @param fromSide - leave side or corner.
 * @param toSide - arrive side or corner.
 */
export function complementaryElbow(
  from: Point,
  to: Point,
  fromSide: OrthogonalAnchorSide,
  toSide: OrthogonalAnchorSide,
): Point[] | undefined {
  if (Math.abs(from.x - to.x) < AXIS_EPS && Math.abs(from.y - to.y) < AXIS_EPS) {
    return [from, to]
  }
  if (isVerticalSide(fromSide) && isHorizontalSide(toSide)) {
    // Leave along ±Y, arrive along ±X → corner (from.x, to.y).
    if (Math.abs(from.x - to.x) < AXIS_EPS || Math.abs(from.y - to.y) < AXIS_EPS) {
      return [from, to]
    }
    return [from, { x: from.x, y: to.y }, to]
  }
  if (isHorizontalSide(fromSide) && isVerticalSide(toSide)) {
    // Leave along ±X, arrive along ±Y → corner (to.x, from.y).
    if (Math.abs(from.x - to.x) < AXIS_EPS || Math.abs(from.y - to.y) < AXIS_EPS) {
      return [from, to]
    }
    return [from, { x: to.x, y: from.y }, to]
  }
  return undefined
}

/**
 * Ensure every consecutive pair shares x or y. Near-aligned points snap;
 * true diagonals get an elbow (prefer continuing the previous segment axis).
 * @param points - polyline including endpoints.
 */
export function orthogonalizePolyline(points: readonly Point[]): Point[] {
  if (points.length < 2) return points.map(p => ({ x: p.x, y: p.y }))
  const out: Point[] = [{ x: points[0]!.x, y: points[0]!.y }]
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]!
    const next = points[i]!
    const dx = Math.abs(next.x - prev.x)
    const dy = Math.abs(next.y - prev.y)
    if (dx <= AXIS_EPS && dy <= AXIS_EPS) continue
    if (dx <= AXIS_EPS) {
      out.push({ x: prev.x, y: next.y })
      continue
    }
    if (dy <= AXIS_EPS) {
      out.push({ x: next.x, y: prev.y })
      continue
    }
    // Diagonal: prefer continuing prior axis when available.
    let preferVertical = false
    if (out.length >= 2) {
      const before = out[out.length - 2]!
      preferVertical = Math.abs(prev.x - before.x) <= AXIS_EPS
    } else {
      preferVertical = dy >= dx
    }
    if (preferVertical) {
      out.push({ x: prev.x, y: next.y })
      out.push({ x: next.x, y: next.y })
    } else {
      out.push({ x: next.x, y: prev.y })
      out.push({ x: next.x, y: next.y })
    }
  }
  return out
}

export function unionPoint(bounds: Rect | undefined, point: Point): Rect {
  if (bounds === undefined) return { x: point.x, y: point.y, width: 1, height: 1 }
  const x = Math.min(bounds.x, point.x)
  const y = Math.min(bounds.y, point.y)
  const right = Math.max(bounds.x + bounds.width, point.x)
  const bottom = Math.max(bounds.y + bounds.height, point.y)
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}


/**
 * Hit-test nodes top-most first.
 * @param point - world point.
 * @param nodes - nodes in paint order (later = top).
 * @param pad - hit padding.
 */
export function hitTestNodes(
  point: Point,
  nodes: readonly GraphNode[],
  pad = 0,
): GraphNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]!
    if (hitRect(point, nodeBounds(node), pad)) return node
  }
  return undefined
}

/**
 * Hit-test groups: among groups containing the point, prefer smallest area;
 * equal area keeps the topmost (later in paint order).
 * @param point - world point.
 * @param groups - groups in paint order (later = top).
 * @param pad - hit padding.
 * @returns winning group, or undefined.
 */
export function hitTestGroups(
  point: Point,
  groups: readonly GraphGroup[],
  pad = 0,
): GraphGroup | undefined {
  let best: GraphGroup | undefined
  let bestArea = Infinity
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i]!
    const bounds = groupBounds(group)
    if (!hitRect(point, bounds, pad)) continue
    const area = bounds.width * bounds.height
    if (best === undefined || area < bestArea) {
      best = group
      bestArea = area
    }
  }
  return best
}

/**
 * Hit-test edges by distance to the same orthogonal polyline used for paint.
 * Closest edge within tolerance wins; nodes must be resolved separately first.
 * @param point - world point.
 * @param edges - candidate edges.
 * @param nodeById - node lookup for endpoints.
 * @param tolerance - max distance in world units.
 */
export function hitTestEdges(
  point: Point,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<string, GraphNode>,
  tolerance: number,
): GraphEdge | undefined {
  let best: GraphEdge | undefined
  let bestDist = tolerance
  for (const edge of edges) {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (from === undefined || to === undefined) continue
    const anchors = edgeAnchors(from, to)
    if (!hitRect(point, anchors.bounds, tolerance)) continue
    const dist = distanceToPolyline(point, anchors.points)
    if (dist <= bestDist) {
      bestDist = dist
      best = edge
    }
  }
  return best
}

export { DEFAULT_H, DEFAULT_W }

/** @param edge - edge whose id is returned. */
export function edgeId(edge: GraphEdge): string {
  return edge.id
}

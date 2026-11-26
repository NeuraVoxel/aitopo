/**
 * Demo-registered vector body images (clean-room Node image path).
 * Call {@link registerDemoVectorImages} once at demo boot.
 */

import {
  anglePivot,
  registerVectorImage,
  unionRect,
  type Rect,
  type VectorImagePaintCtx,
} from '../../src/index.ts'

const HEADING_KEY = 'demo-heading-arrow'

/**
 * Register demo vector images used by Elements Node (and reusable elsewhere).
 */
export function registerDemoVectorImages(): void {
  registerVectorImage({
    key: HEADING_KEY,
    draw(ctx, body, paintCtx) {
      drawHeadingArrow(ctx, body, paintCtx)
    },
    bounds(body, paintCtx) {
      return headingArrowBounds(body, paintCtx)
    },
  })
}

export { HEADING_KEY as DEMO_HEADING_VECTOR_IMAGE }

interface HeadingGeom {
  readonly axle: { readonly x: number; readonly y: number }
  readonly tipY: number
  readonly len: number
  readonly half: number
  readonly label: string
}

function headingGeom(body: Rect, paintCtx: VectorImagePaintCtx): HeadingGeom {
  const { node, state, phase } = paintCtx
  const axle = anglePivot(body, node.angleAnchor ?? { u: 0.5, v: 0.82 })
  const speedRaw = node.data?.speedMs
  const speed = typeof speedRaw === 'number'
    ? speedRaw
    : typeof speedRaw === 'string'
      ? Number(speedRaw)
      : 10
  const baseLen = Number.isFinite(speed) ? Math.max(24, speed * 6) : 60
  const pulse = phase ?? 0
  const len = state === 'boost'
    ? baseLen * 1.35
    : baseLen * (0.85 + 0.3 * Math.sin(pulse * Math.PI * 2))
  const tipY = axle.y - len
  const head = Math.max(6, len * 0.12)
  const half = head * 0.7
  const yaw = node.angle ?? 0
  const label = `${Number.isFinite(speed) ? speed : '?'} m/s · ${yaw}°`
  return { axle, tipY, len, half, label }
}

/**
 * Heading arrow from rear-axle (or center) local origin along −Y.
 * Length scales with `data.speedMs` (number|string); pulse with `phase` / state.
 */
function drawHeadingArrow(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  paintCtx: VectorImagePaintCtx,
): void {
  const { state } = paintCtx
  const { axle, tipY, half, label } = headingGeom(body, paintCtx)
  const head = Math.max(6, (axle.y - tipY) * 0.12)

  ctx.save()
  ctx.strokeStyle = state === 'boost' ? '#dc2626' : '#1d4ed8'
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(axle.x, axle.y)
  ctx.lineTo(axle.x, tipY + head)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(axle.x, tipY)
  ctx.lineTo(axle.x - half, tipY + head)
  ctx.lineTo(axle.x + half, tipY + head)
  ctx.closePath()
  ctx.fill()

  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1e3a8a'
  ctx.fillText(label, axle.x + 8, (axle.y + tipY) / 2)
  ctx.restore()
}

/** Unrotated AABB covering shaft, chevron, and speed/yaw label (for dirty union). */
function headingArrowBounds(body: Rect, paintCtx: VectorImagePaintCtx): Rect {
  const { axle, tipY, half, label } = headingGeom(body, paintCtx)
  const labelW = Math.ceil(label.length * 7)
  const labelH = 14
  const pad = 4
  const arrow: Rect = {
    x: axle.x - half - pad,
    y: tipY - pad,
    width: half * 2 + pad * 2,
    height: axle.y - tipY + pad * 2,
  }
  const text: Rect = {
    x: axle.x + 8 - pad,
    y: (axle.y + tipY) / 2 - labelH / 2 - pad,
    width: labelW + pad * 2,
    height: labelH + pad * 2,
  }
  return unionRect(unionRect(body, arrow), text)!
}

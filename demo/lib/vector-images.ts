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
import { ADAS_AGENT, ADAS_BRAND, ADAS_TRAJECTORY } from './adas-theme.ts'

const HEADING_KEY = 'demo-heading-arrow'
const AXLE_FRAME_KEY = 'demo-ego-axle-frame'
const EGO_VECTOR_KEY = 'demo-ego-car-vector'
const EGO_BITMAP_KEY = 'demo-ego-car-bitmap'

/** Public URL for the bird's-eye ego PNG (Vite `demo/public`). */
const EGO_BITMAP_URL = '/assets/ego-car.png'

let egoBitmapReady: Promise<void> = Promise.resolve()

/**
 * Resolves when the demo ego PNG is decoded (or load failed).
 * Hosts can wait then touch the bitmap node so the first frame is not empty.
 */
export function whenDemoEgoBitmapReady(): Promise<void> {
  return egoBitmapReady
}

/**
 * Register demo vector images used by ADAS Ego (and reusable elsewhere).
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

  registerVectorImage({
    key: AXLE_FRAME_KEY,
    draw(ctx, body, paintCtx) {
      // Axes under heading so the forward chevron stays visible past +x.
      drawAxleFrame(ctx, body, paintCtx)
      drawHeadingArrow(ctx, body, paintCtx)
    },
    bounds(body, paintCtx) {
      return axleFrameBounds(body, paintCtx)
    },
  })

  registerVectorImage({
    key: EGO_VECTOR_KEY,
    draw(ctx, body) {
      drawEgoVectorCar(ctx, body)
    },
  })

  const bitmap = new Image()
  bitmap.src = EGO_BITMAP_URL
  egoBitmapReady = bitmap.decode().then(() => undefined, () => undefined)
  registerVectorImage({
    key: EGO_BITMAP_KEY,
    draw(ctx, body) {
      drawEgoBitmap(ctx, body, bitmap)
    },
  })
}

export {
  HEADING_KEY as DEMO_HEADING_VECTOR_IMAGE,
  AXLE_FRAME_KEY as DEMO_EGO_AXLE_FRAME_IMAGE,
  EGO_VECTOR_KEY as DEMO_EGO_CAR_VECTOR_IMAGE,
  EGO_BITMAP_KEY as DEMO_EGO_CAR_BITMAP_IMAGE,
}

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

  // nuBoard trajectory: ego cyan; boost uses expert-ego orange.
  const ink = state === 'boost' ? ADAS_TRAJECTORY.expert : ADAS_TRAJECTORY.ego
  ctx.save()
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
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
  ctx.fillStyle = ADAS_BRAND.navy
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

/** Vehicle frame axis lengths in body pixels (from rear-axle origin). */
const AXLE_X_LEN = 36
const AXLE_Y_LEN = 28

/**
 * Ego vehicle frame at rear axle: +x forward (−Y body), +y left (−X body),
 * origin marker. Drawn after the heading arrow for style #7.
 */
function drawAxleFrame(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  paintCtx: VectorImagePaintCtx,
): void {
  const axle = anglePivot(body, paintCtx.node.angleAnchor ?? { u: 0.5, v: 0.82 })

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.font = 'bold 11px sans-serif'

  // +x forward (ego trajectory cyan); +y left (expert trajectory orange)
  drawFrameAxis(ctx, axle.x, axle.y, 0, -1, AXLE_X_LEN, ADAS_TRAJECTORY.ego, 'x')
  drawFrameAxis(ctx, axle.x, axle.y, -1, 0, AXLE_Y_LEN, ADAS_TRAJECTORY.expert, 'y')

  ctx.beginPath()
  ctx.arc(axle.x, axle.y, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = ADAS_BRAND.navy
  ctx.fill()
  ctx.strokeStyle = ADAS_AGENT.ego.fill
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = ADAS_BRAND.navy
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('O', axle.x + 5, axle.y + 4)
  ctx.restore()
}

function drawFrameAxis(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  len: number,
  color: string,
  label: string,
): void {
  const tipX = ox + dx * len
  const tipY = oy + dy * len
  const head = 8
  const half = 4.5
  // Perpendicular for chevron
  const px = -dy
  const py = dx

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(tipX - dx * head, tipY - dy * head)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(tipX - dx * head + px * half, tipY - dy * head + py * half)
  ctx.lineTo(tipX - dx * head - px * half, tipY - dy * head - py * half)
  ctx.closePath()
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, tipX + dx * 10, tipY + dy * 10)
}

/** Dirty union of heading overlay plus vehicle-frame axes and origin label. */
function axleFrameBounds(body: Rect, paintCtx: VectorImagePaintCtx): Rect {
  const heading = headingArrowBounds(body, paintCtx)
  const axle = anglePivot(body, paintCtx.node.angleAnchor ?? { u: 0.5, v: 0.82 })
  const pad = 14
  const axes: Rect = {
    x: axle.x - AXLE_Y_LEN - pad,
    y: axle.y - AXLE_X_LEN - pad,
    width: AXLE_Y_LEN + pad * 2,
    height: AXLE_X_LEN + pad * 2,
  }
  return unionRect(heading, axes)!
}

/** Inset bird's-eye car drawn with canvas paths (vector ego chrome). */
function drawEgoVectorCar(ctx: CanvasRenderingContext2D, body: Rect): void {
  const pad = 3
  const x = body.x + pad
  const y = body.y + pad
  const w = body.width - pad * 2
  const h = body.height - pad * 2
  if (w <= 0 || h <= 0) return

  ctx.save()
  // Hull — nuBoard ego white / gray
  roundRectPath(ctx, x, y, w, h, Math.min(8, w / 4, h / 8))
  ctx.fillStyle = ADAS_AGENT.ego.fill
  ctx.fill()
  ctx.strokeStyle = ADAS_AGENT.ego.stroke
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Windshield
  roundRectPath(ctx, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.22, 4)
  ctx.fillStyle = ADAS_BRAND.lightAsphalt
  ctx.fill()

  // Roof
  roundRectPath(ctx, x + w * 0.18, y + h * 0.36, w * 0.64, h * 0.28, 3)
  ctx.fillStyle = ADAS_BRAND.mediumAsphalt
  ctx.fill()

  // Rear glass
  roundRectPath(ctx, x + w * 0.12, y + h * 0.68, w * 0.76, h * 0.16, 3)
  ctx.fillStyle = ADAS_BRAND.darkAsphalt
  ctx.fill()

  // Headlights
  ctx.fillStyle = ADAS_AGENT.barrier.fill
  ctx.beginPath()
  ctx.ellipse(x + w * 0.22, y + h * 0.06, w * 0.12, h * 0.035, 0, 0, Math.PI * 2)
  ctx.ellipse(x + w * 0.78, y + h * 0.06, w * 0.12, h * 0.035, 0, 0, Math.PI * 2)
  ctx.fill()

  // Taillights
  ctx.fillStyle = ADAS_AGENT.bicycle.fill
  roundRectPath(ctx, x + w * 0.08, y + h * 0.9, w * 0.22, h * 0.06, 2)
  ctx.fill()
  roundRectPath(ctx, x + w * 0.7, y + h * 0.9, w * 0.22, h * 0.06, 2)
  ctx.fill()

  // Wheels
  ctx.fillStyle = ADAS_BRAND.navy
  const wh = h * 0.12
  const ww = w * 0.1
  roundRectPath(ctx, x - ww * 0.35, y + h * 0.22, ww, wh, 2)
  ctx.fill()
  roundRectPath(ctx, x + w - ww * 0.65, y + h * 0.22, ww, wh, 2)
  ctx.fill()
  roundRectPath(ctx, x - ww * 0.35, y + h * 0.62, ww, wh, 2)
  ctx.fill()
  roundRectPath(ctx, x + w - ww * 0.65, y + h * 0.62, ww, wh, 2)
  ctx.fill()
  ctx.restore()
}

/** Raster ego: draw the public PNG inside the body inset (border is body stroke). */
function drawEgoBitmap(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  image: HTMLImageElement,
): void {
  if (!image.complete || image.naturalWidth === 0) return
  const pad = 3
  const w = body.width - pad * 2
  const h = body.height - pad * 2
  if (w <= 0 || h <= 0) return
  ctx.drawImage(image, body.x + pad, body.y + pad, w, h)
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

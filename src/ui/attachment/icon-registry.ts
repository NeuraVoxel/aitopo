/**
 * Built-in vector icon keys for IconsAttachment.
 */

/** Drawable vector icon definition (normalized to unit square, then scaled). */
export interface IconDefinition {
  readonly key: string
  /**
   * Draw the icon into a canvas context.
   * Caller sets transform so (0,0)–(size,size) is the icon box.
   * @param ctx - 2d context.
   * @param size - box edge length in world px.
   * @param color - stroke/fill color.
   */
  readonly draw: (ctx: CanvasRenderingContext2D, size: number, color: string) => void
}

const icons = new Map<string, IconDefinition>()

function registerBuiltin(def: IconDefinition): void {
  icons.set(def.key, def)
}

registerBuiltin({
  key: 'node',
  draw(ctx, size, color) {
    const pad = size * 0.18
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, size * 0.08)
    ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2)
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  },
})

registerBuiltin({
  key: 'server',
  draw(ctx, size, color) {
    const pad = size * 0.2
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(1, size * 0.07)
    const h = (size - pad * 2) / 3
    for (let i = 0; i < 3; i += 1) {
      const y = pad + i * h
      ctx.strokeRect(pad, y, size - pad * 2, h * 0.85)
    }
  },
})

registerBuiltin({
  key: 'router',
  draw(ctx, size, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, size * 0.08)
    ctx.beginPath()
    ctx.moveTo(size * 0.2, size * 0.5)
    ctx.lineTo(size * 0.8, size * 0.5)
    ctx.moveTo(size * 0.5, size * 0.2)
    ctx.lineTo(size * 0.5, size * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(size * 0.5, size * 0.5, size * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  },
})

registerBuiltin({
  key: 'group',
  draw(ctx, size, color) {
    const pad = size * 0.18
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(1, size * 0.08)
    // Stacked rounded cards — collapsed Group body (twaver IMAGE_GROUP idea).
    ctx.strokeRect(pad + size * 0.08, pad, size - pad * 2 - size * 0.08, size * 0.42)
    ctx.strokeRect(pad, pad + size * 0.28, size - pad * 2 - size * 0.08, size * 0.42)
  },
})

/**
 * Register or replace an icon definition.
 * @param definition - icon to store.
 */
export function registerIcon(definition: IconDefinition): void {
  icons.set(definition.key, definition)
}

/**
 * Resolve an icon key; unknown / omitted keys use `fallback` (default `node`).
 * @param key - registry key (may be undefined).
 * @param fallback - key when `key` is missing or unknown.
 */
export function getIcon(key: string | undefined, fallback = 'node'): IconDefinition {
  if (key !== undefined) {
    const found = icons.get(key)
    if (found !== undefined) return found
  }
  return icons.get(fallback) ?? icons.get('node')!
}

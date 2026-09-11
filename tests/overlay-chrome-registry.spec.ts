import { describe, expect, it, vi } from 'vitest'
import { OverlayChromeRegistry } from '../src/network/overlay-chrome-registry.ts'
import type { Renderer } from '../src/render/canvas2d.ts'

describe('OverlayChromeRegistry', () => {
  it('paints registered chrome and stops after dispose', () => {
    const requestOverlayPaint = vi.fn()
    const registry = new OverlayChromeRegistry(requestOverlayPaint)
    const paints: string[] = []
    const remove = registry.add({
      paint() {
        paints.push('a')
      },
    })
    expect(requestOverlayPaint).toHaveBeenCalledTimes(1)

    const renderer = { drawMarquee: vi.fn() } as unknown as Renderer
    registry.paintAll(renderer)
    expect(paints).toEqual(['a'])

    remove()
    expect(requestOverlayPaint).toHaveBeenCalledTimes(2)
    paints.length = 0
    registry.paintAll(renderer)
    expect(paints).toEqual([])
  })
})

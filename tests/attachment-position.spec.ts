/**
 * placeAttachment insideTop* anchors.
 */

import { describe, expect, it } from 'vitest'
import { placeAttachment } from '../src/ui/attachment/position.ts'

const body = { x: 100, y: 200, width: 300, height: 150 }

describe('placeAttachment insideTop*', () => {
  it('places insideTopLeft fully inside the body with ~8px inset', () => {
    const box = placeAttachment(body, 'insideTopLeft', 80, 14)
    expect(box.x).toBe(108)
    expect(box.y).toBe(208)
    expect(box.x + box.width).toBeLessThanOrEqual(body.x + body.width)
    expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height)
  })

  it('places insideTop centered on the top edge inside the body', () => {
    const box = placeAttachment(body, 'insideTop', 80, 14)
    expect(box.x).toBe(body.x + body.width / 2 - 40)
    expect(box.y).toBe(208)
  })

  it('places insideTopRight inset from the top-right corner', () => {
    const box = placeAttachment(body, 'insideTopRight', 80, 14)
    expect(box.x).toBe(body.x + body.width - 80 - 8)
    expect(box.y).toBe(208)
  })

  it('places insideBottom centered near the bottom inside the body', () => {
    const box = placeAttachment(body, 'insideBottom', 80, 14)
    expect(box.x).toBe(body.x + body.width / 2 - 40)
    expect(box.y).toBe(body.y + body.height - 16 - 14)
    expect(box.y + box.height).toBeLessThanOrEqual(body.y + body.height)
  })

  it('keeps outside topLeft above the body', () => {
    const box = placeAttachment(body, 'topLeft', 80, 14)
    expect(box.y + box.height).toBeLessThanOrEqual(body.y)
  })
})

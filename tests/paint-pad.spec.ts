import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GLOW_BLUR,
  DEFAULT_NODE_SHADOW,
  PAINT_GLOW_EXTENT_PAD,
  PAINT_SHADOW_EXTENT_PAD,
  paintExtentGrow,
} from '../src/network/paint-pad.ts'

describe('paintExtentGrow', () => {
  it('uses named shadow/glow pads around blur and offsets', () => {
    expect(paintExtentGrow({
      shadowBlur: 6,
      shadowOffsetX: 3,
      shadowOffsetY: 2,
    })).toBe(6 + 3 + 2 + PAINT_SHADOW_EXTENT_PAD)

    expect(paintExtentGrow({
      includeGlow: true,
      glowBlur: DEFAULT_GLOW_BLUR,
    })).toBe(DEFAULT_GLOW_BLUR + PAINT_GLOW_EXTENT_PAD)
  })

  it('takes the max of shadow and glow extents', () => {
    const shadowOnly = paintExtentGrow({
      shadowBlur: DEFAULT_NODE_SHADOW.blur,
      shadowOffsetX: DEFAULT_NODE_SHADOW.offsetX,
      shadowOffsetY: DEFAULT_NODE_SHADOW.offsetY,
    })
    const withGlow = paintExtentGrow({
      shadowBlur: DEFAULT_NODE_SHADOW.blur,
      shadowOffsetX: DEFAULT_NODE_SHADOW.offsetX,
      shadowOffsetY: DEFAULT_NODE_SHADOW.offsetY,
      includeGlow: true,
      glow: true,
      glowBlur: 16,
    })
    expect(withGlow).toBeGreaterThan(shadowOnly)
    expect(withGlow).toBe(16 + PAINT_GLOW_EXTENT_PAD)
  })

  it('honors explicit pad overrides', () => {
    expect(paintExtentGrow({
      shadowBlur: 1,
      shadowExtentPad: 10,
    })).toBe(11)
    expect(paintExtentGrow({
      includeGlow: true,
      glowBlur: 1,
      glowExtentPad: 7,
    })).toBe(8)
  })
})

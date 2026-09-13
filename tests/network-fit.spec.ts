import { describe, expect, it } from 'vitest'
import { Network, contentBounds } from '../src/network/network.ts'

describe('fit calculation', () => {
  it('contentBounds counts label attachments beyond node bodies', () => {
    const network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'unit',
        label: 'x'.repeat(60),
        x: 100,
        y: 100,
        w: 50,
        h: 50,
      }],
      edges: [],
      groups: [],
    })
    const bodyOnly = { x: 100, y: 100, width: 50, height: 50 }
    const bounds = network.contentBounds()
    expect(bounds).toBeDefined()
    // The unlimited-length label hangs below the body; fit bounds must cover it.
    expect(bounds!.height).toBeGreaterThan(bodyOnly.height)
  })

  it('contentBounds uses the expanded band for auto-fit groups', () => {
    const network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      nodes: [
        { id: 'a', type: 'unit', label: 'A', x: 200, y: 200, w: 50, h: 50, groupId: 'g' },
        { id: 'b', type: 'unit', label: 'B', x: 400, y: 200, w: 50, h: 50, groupId: 'g' },
      ],
      edges: [],
      groups: [{
        id: 'g',
        label: 'Band',
        memberIds: ['a', 'b'],
        expanded: true,
        x: 10,
        y: 10,
        w: 40,
        h: 40,
      }],
    })
    // Declared rect is 10,10 40x40; the real band wraps the members near 200..450.
    const bounds = network.contentBounds()!
    expect(bounds.x).toBeGreaterThan(100)
    expect(bounds.x + bounds.width).toBeGreaterThan(400)
  })

  it('fitContent keeps long labels inside the viewport with padding', () => {
    const network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'unit',
        label: 'x'.repeat(60),
        x: 100,
        y: 100,
        w: 50,
        h: 50,
      }],
      edges: [],
      groups: [],
    })
    network.updateCamera(viewport => {
      viewport.setViewSize({ width: 800, height: 600 })
    })
    network.fitContent(32)
    const bounds = network.contentBounds()!
    // Content center lands on the viewport center.
    const center = network.viewport.worldToScreen({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    })
    expect(center.x).toBeCloseTo(400, 0)
    expect(center.y).toBeCloseTo(300, 0)
    // Every edge of the painted content stays inside the padded container.
    const topLeft = network.viewport.worldToScreen({ x: bounds.x, y: bounds.y })
    const bottomRight = network.viewport.worldToScreen({
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
    })
    expect(topLeft.x).toBeGreaterThanOrEqual(30)
    expect(topLeft.y).toBeGreaterThanOrEqual(30)
    expect(bottomRight.x).toBeLessThanOrEqual(770)
    expect(bottomRight.y).toBeLessThanOrEqual(570)
  })

  it('standalone contentBounds unions scene geometry', () => {
    const network = new Network({ defaultInteractions: false })
    network.load({
      version: 1,
      nodes: [{ id: 'a', type: 'unit', label: 'A', x: 0, y: 0, w: 50, h: 50 }],
      edges: [],
      groups: [],
    })
    expect(contentBounds(network.scene)).toEqual({ x: 0, y: 0, width: 50, height: 50 })
  })
})

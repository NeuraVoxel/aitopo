/**
 * SubNetwork navigation restores cameras both ways:
 * exit → pre-enter parent camera; re-enter → last in-child camera.
 */

import { describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'

function loadPortalDoc(network: Network): void {
  network.load({
    version: 1,
    nodes: [
      { id: 'hub', type: 'portal', label: 'Hub', x: 0, y: 0, w: 80, h: 40, networkId: 'child' },
      { id: 'side', type: 'agent', label: 'Side', x: 400, y: 200, w: 50, h: 50 },
    ],
    edges: [],
    networks: {
      child: {
        version: 1,
        nodes: [
          { id: 'inner', type: 'agent', label: 'Inner', x: 20, y: 20, w: 50, h: 50 },
        ],
        edges: [],
      },
    },
  })
}

describe('SubNetwork camera restore', () => {
  it('exit restores zoom and pan pushed on enter', () => {
    const network = new Network()
    loadPortalDoc(network)
    network.updateCamera(vp => {
      vp.setCamera({ x: 120, y: 80, zoom: 1.75 })
    })
    const before = { ...network.viewport.state }

    network.enterSubNetwork('child')
    network.updateCamera(vp => {
      vp.setCamera({ x: 0, y: 0, zoom: 0.5 })
    })
    expect(network.viewport.state.zoom).toBe(0.5)

    network.exitSubNetwork()
    expect(network.viewport.state.x).toBeCloseTo(before.x)
    expect(network.viewport.state.y).toBeCloseTo(before.y)
    expect(network.viewport.state.zoom).toBeCloseTo(before.zoom)
    expect(network.scene.camera.zoom).toBeCloseTo(before.zoom)
  })

  it('nested exit restores each level independently', () => {
    const network = new Network()
    network.load({
      version: 1,
      nodes: [{ id: 'a', type: 'portal', label: 'A', networkId: 'ring' }],
      edges: [],
      networks: {
        ring: {
          version: 1,
          nodes: [{ id: 'b', type: 'portal', label: 'B', networkId: 'leaf' }],
          edges: [],
          networks: {
            leaf: {
              version: 1,
              nodes: [{ id: 'c', type: 'agent', label: 'C' }],
              edges: [],
            },
          },
        },
      },
    })
    network.updateCamera(vp => vp.setCamera({ x: 10, y: 20, zoom: 2 }))
    network.enterSubNetwork('ring')
    network.updateCamera(vp => vp.setCamera({ x: 30, y: 40, zoom: 1.2 }))
    network.enterSubNetwork('leaf')
    network.updateCamera(vp => vp.setCamera({ x: 0, y: 0, zoom: 0.4 }))

    network.exitSubNetwork()
    expect(network.viewport.state).toMatchObject({ x: 30, y: 40, zoom: 1.2 })

    network.exitSubNetwork()
    expect(network.viewport.state).toMatchObject({ x: 10, y: 20, zoom: 2 })
  })

  it('emits viewportChanged when restoring on exit', () => {
    const network = new Network()
    loadPortalDoc(network)
    network.updateCamera(vp => vp.setCamera({ x: 50, y: 60, zoom: 1.5 }))
    const handler = vi.fn()
    network.on(handler)
    network.enterSubNetwork('child')
    handler.mockClear()
    network.exitSubNetwork()
    const viewportEvents = handler.mock.calls
      .map(c => c[0])
      .filter((e: { type: string }) => e.type === 'viewportChanged')
    expect(viewportEvents.length).toBeGreaterThanOrEqual(1)
    expect(viewportEvents[0]).toMatchObject({
      type: 'viewportChanged',
      viewport: { x: 50, y: 60, zoom: 1.5 },
    })
  })

  it('load clears the camera stack so exit after reload does not restore stale cameras', () => {
    const network = new Network()
    loadPortalDoc(network)
    network.updateCamera(vp => vp.setCamera({ x: 1, y: 2, zoom: 2 }))
    network.enterSubNetwork('child')
    // Reload resets stack; document camera defaults apply.
    loadPortalDoc(network)
    expect(network.currentNetworkId).toBeNull()
    network.updateCamera(vp => vp.setCamera({ x: 9, y: 9, zoom: 1.1 }))
    network.enterSubNetwork('child')
    network.exitSubNetwork()
    expect(network.viewport.state).toMatchObject({ x: 9, y: 9, zoom: 1.1 })
  })

  it('re-enter restores the camera from the previous visit (last exit)', () => {
    const network = new Network()
    loadPortalDoc(network)
    network.updateCamera(vp => vp.setCamera({ x: 10, y: 10, zoom: 1 }))
    network.enterSubNetwork('child')
    network.updateCamera(vp => vp.setCamera({ x: 70, y: 80, zoom: 1.4 }))
    const childCam = { x: 70, y: 80, zoom: 1.4 }
    network.exitSubNetwork()
    expect(network.viewport.state.zoom).toBeCloseTo(1)

    const handler = vi.fn()
    network.on(handler)
    network.enterSubNetwork('child')
    expect(network.viewport.state).toMatchObject(childCam)
    expect(network.scene.camera.zoom).toBeCloseTo(childCam.zoom)
    const nav = handler.mock.calls.map(c => c[0]).find(
      (e: { type: string }) => e.type === 'subNetworkChanged',
    )
    expect(nav).toMatchObject({
      direction: 'enter',
      cameraRestored: true,
    })
  })

  it('first enter reports cameraRestored false', () => {
    const network = new Network()
    loadPortalDoc(network)
    const handler = vi.fn()
    network.on(handler)
    network.enterSubNetwork('child')
    const nav = handler.mock.calls.map(c => c[0]).find(
      (e: { type: string }) => e.type === 'subNetworkChanged',
    )
    expect(nav).toMatchObject({
      direction: 'enter',
      cameraRestored: false,
    })
  })

  it('first enter fits content instead of keeping parent zoom when view is sized', () => {
    const network = new Network({ defaultInteractions: false })
    loadPortalDoc(network)
    network.updateCamera(vp => {
      vp.setViewSize({ width: 800, height: 600 })
      vp.setCamera({ x: 120, y: 80, zoom: 1.75 })
    })
    network.enterSubNetwork('child')
    expect(network.viewport.state.zoom).not.toBeCloseTo(1.75)
    const bounds = network.contentBounds()!
    const center = network.viewport.worldToScreen({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    })
    expect(center.x).toBeCloseTo(400, 0)
    expect(center.y).toBeCloseTo(300, 0)
  })

  it('first enter without a sized view keeps the parent camera (headless)', () => {
    const network = new Network()
    loadPortalDoc(network)
    network.updateCamera(vp => vp.setCamera({ x: 120, y: 80, zoom: 1.75 }))
    network.enterSubNetwork('child')
    expect(network.viewport.state).toMatchObject({ x: 120, y: 80, zoom: 1.75 })
  })
})

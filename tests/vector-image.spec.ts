import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'
import { NodeView } from '../src/ui/node-view.ts'
import {
  getVectorImage,
  registerVectorImage,
  vectorImagePaintCtx,
} from '../src/ui/vector-image-registry.ts'

describe('vector image registry', () => {
  it('registers and resolves a vector image; unknown keys are undefined', () => {
    registerVectorImage({
      key: 'test-arrow',
      draw() {
        /* no-op */
      },
    })
    expect(getVectorImage('test-arrow')?.key).toBe('test-arrow')
    expect(getVectorImage('missing')).toBeUndefined()
    expect(getVectorImage(undefined)).toBeUndefined()
  })

  it('parses vectorImage and vectorImageState; phase binds from data', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'vehicle',
        label: 'A',
        vectorImage: 'test-arrow',
        data: { vectorImagePhase: 0.4, speedMs: 10 },
        style: { vectorImageState: 'boost', showIcon: false },
      }],
      edges: [],
    })
    expect(doc.nodes[0]?.vectorImage).toBe('test-arrow')
    expect(doc.nodes[0]?.style?.vectorImageState).toBe('boost')
    const ctx = vectorImagePaintCtx(doc.nodes[0]!)
    expect(ctx.state).toBe('boost')
    expect(ctx.phase).toBeCloseTo(0.4, 10)
  })

  it('keeps vectorImage across updateNode and exposes phase for redraw binding', () => {
    const doc = parseDocument({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'vehicle',
        label: 'A',
        vectorImage: 'test-arrow',
        data: { fill: '#fff', vectorImagePhase: 0 },
      }],
      edges: [],
    })
    const next = applyPatch(doc, {
      ops: [{
        op: 'updateNode',
        id: 'a',
        patch: { data: { fill: '#fff', vectorImagePhase: 0.75 } },
      }],
    })
    expect(next.nodes[0]?.vectorImage).toBe('test-arrow')
    expect(vectorImagePaintCtx(next.nodes[0]!).phase).toBe(0.75)
  })

  it('NodeView union includes vectorImage.bounds past the body (dirty coverage)', () => {
    registerVectorImage({
      key: 'tall-arrow',
      draw() {
        /* paint omitted */
      },
      bounds(body) {
        return {
          x: body.x,
          y: body.y - 120,
          width: body.width,
          height: body.height + 120,
        }
      },
    })
    const doc = parseDocument({
      version: 1,
      nodes: [{
        id: 'v',
        type: 'vehicle',
        label: 'V',
        x: 100,
        y: 200,
        w: 40,
        h: 80,
        vectorImage: 'tall-arrow',
        style: { showIcon: false },
      }],
      edges: [],
    })
    const scene = new GraphScene()
    scene.load(doc)
    const view = new NodeView('v')
    view.validate(scene)
    expect(view.bodyBounds).toEqual({ x: 100, y: 200, width: 40, height: 80 })
    expect(view.bounds.y).toBeLessThanOrEqual(80)
    expect(view.bounds.height).toBeGreaterThanOrEqual(200)
  })
})

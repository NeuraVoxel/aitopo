/**
 * Edge attachment / dual-bounds / style paint behavior.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'

function loadEdgeDoc(extra: Record<string, unknown> = {}) {
  const scene = new GraphScene()
  scene.load({
    version: 1,
    nodes: [
      { id: 'a', type: 'agent', label: 'A', x: 0, y: 0, w: 50, h: 50 },
      { id: 'b', type: 'agent', label: 'B', x: 200, y: 0, w: 50, h: 50 },
    ],
    edges: [{
      id: 'e1',
      from: 'a',
      to: 'b',
      ...extra,
    }],
  })
  const views = new ViewSet()
  views.rebuild(scene)
  views.validateDirty(scene)
  return { scene, views }
}

describe('Edge attachments', () => {
  it('exposes pathBounds and larger unionBounds when label is set', () => {
    const { views } = loadEdgeDoc({ label: 'link' })
    const view = views.getEdge('e1')!
    expect(view.pathBounds.width).toBeGreaterThan(0)
    expect(view.unionBounds.height).toBeGreaterThan(view.pathBounds.height)
    expect(view.bounds).toEqual(view.unionBounds)
  })

  it('emits label/label2/alarm attachment ops from protocol fields', () => {
    const { views } = loadEdgeDoc({
      label: 'mid',
      label2: 'near-from',
      alarms: [{ id: 'al', level: 'error', message: 'down' }],
    })
    const paint = views.getEdge('e1')!.toPaintView(false, false)
    const kinds = paint.attachments.map(op => op.kind)
    expect(kinds).toContain('label')
    expect(kinds).toContain('label2')
    expect(kinds).toContain('alarm')
    expect(paint.arrowTo).toBeDefined()
    expect(paint.arrowFrom).toBeUndefined()
  })

  it('defaults arrowTo true and honors arrowFrom / arrowTo false', () => {
    const { scene, views } = loadEdgeDoc({ style: { arrowTo: false, arrowFrom: true } })
    let paint = views.getEdge('e1')!.toPaintView(false, false)
    expect(paint.arrowTo).toBeUndefined()
    expect(paint.arrowFrom).toBeDefined()
    scene.apply({
      ops: [{ op: 'updateEdge', id: 'e1', patch: { style: { arrowTo: true, arrowFrom: false } } }],
    })
    views.markDirty('e1')
    views.validateDirty(scene)
    paint = views.getEdge('e1')!.toPaintView(false, false)
    expect(paint.arrowTo).toBeDefined()
    expect(paint.arrowFrom).toBeUndefined()
  })

  it('defaults paint alpha to 1 and applies style.alpha', () => {
    const { scene, views } = loadEdgeDoc({})
    expect(views.getEdge('e1')!.toPaintView(false, false).alpha).toBe(1)
    scene.apply({ ops: [{ op: 'updateEdge', id: 'e1', patch: { style: { alpha: 0.35 } } }] })
    views.markDirty('e1')
    views.validateDirty(scene)
    expect(views.getEdge('e1')!.toPaintView(false, false).alpha).toBe(0.35)
  })

  it('merges style one level and paints stroke from style not data', () => {
    const { scene, views } = loadEdgeDoc({
      label: 'x',
      style: { stroke: '#111111', lineWidth: 2 },
      data: { stroke: '#ff0000', label: 'ignored' },
    })
    let paint = views.getEdge('e1')!.toPaintView(false, false)
    expect(paint.stroke).toBe('#111111')
    expect(paint.lineWidth).toBe(2)
    expect(paint.attachments.some(op => op.kind === 'label' && 'text' in op && op.text === 'x')).toBe(true)
    scene.apply({
      ops: [{ op: 'updateEdge', id: 'e1', patch: { style: { strokeHover: '#00ff00' } } }],
    })
    views.markDirty('e1')
    views.validateDirty(scene)
    paint = views.getEdge('e1')!.toPaintView(false, true)
    expect(paint.stroke).toBe('#00ff00')
    // Prior stroke retained via one-level merge.
    paint = views.getEdge('e1')!.toPaintView(false, false)
    expect(paint.stroke).toBe('#111111')
  })

  it('keeps hover tooltip off union and on overlay when hovered', () => {
    const { views } = loadEdgeDoc({
      tooltip: 'tip',
      style: { tooltipMode: 'hover' },
    })
    const view = views.getEdge('e1')!
    expect(view.unionBounds).toEqual(view.pathBounds)
    const idle = view.toPaintView(false, false)
    expect(idle.attachments.some(op => op.kind === 'tooltip')).toBe(false)
    expect(idle.overlayAttachments.some(op => op.kind === 'tooltip')).toBe(false)
    const hovered = view.toPaintView(false, true)
    expect(hovered.overlayAttachments.some(op => op.kind === 'tooltip')).toBe(true)
  })

  it('always tooltip joins union and scene attachments', () => {
    const { views } = loadEdgeDoc({
      tooltip: 'always',
      style: { tooltipMode: 'always' },
    })
    const view = views.getEdge('e1')!
    expect(view.unionBounds.height).toBeGreaterThan(view.pathBounds.height)
    const paint = view.toPaintView(false, false)
    expect(paint.attachments.some(op => op.kind === 'tooltip')).toBe(true)
  })
})

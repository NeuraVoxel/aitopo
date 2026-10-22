/**
 * Edge label offset sides: pathLeft default, aboveOrRight for skill H/V rules.
 */

import { describe, expect, it } from 'vitest'
import { placeAlongPath } from '../src/ui/attachment/path.ts'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('placeAlongPath labelSide', () => {
  const horizontal = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ]
  const vertical = [
    { x: 50, y: 0 },
    { x: 50, y: 200 },
  ]

  it('defaults to pathLeft (below a left-to-right segment)', () => {
    const box = placeAlongPath(horizontal, 0.5, 20, 10)
    expect(box.y + box.height / 2).toBeGreaterThan(100)
  })

  it('places aboveOrRight above a horizontal segment', () => {
    const box = placeAlongPath(horizontal, 0.5, 20, 10, 8, 'aboveOrRight')
    expect(box.y + box.height / 2).toBeLessThan(100)
    expect(box.x + box.width / 2).toBeCloseTo(100)
  })

  it('places aboveOrRight to the right of a vertical segment', () => {
    const box = placeAlongPath(vertical, 0.5, 20, 10, 8, 'aboveOrRight')
    expect(box.x + box.width / 2).toBeGreaterThan(50)
    expect(box.y + box.height / 2).toBeCloseTo(100)
  })

  it('pathRight mirrors pathLeft across the stroke', () => {
    const left = placeAlongPath(horizontal, 0.5, 20, 10, 8, 'pathLeft')
    const right = placeAlongPath(horizontal, 0.5, 20, 10, 8, 'pathRight')
    expect(left.y + left.height / 2).toBeGreaterThan(100)
    expect(right.y + right.height / 2).toBeLessThan(100)
  })
})

describe('EdgeLabelAttachment labelSide', () => {
  it('honors style.labelSide aboveOrRight on a horizontal edge', () => {
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
        label: 'flow',
        style: { labelSide: 'aboveOrRight' },
      }],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const paint = views.getEdge('e1')!.toPaintView(false, false)
    const label = paint.attachments.find(op => op.kind === 'label')
    expect(label).toBeDefined()
    if (label === undefined || !('bounds' in label)) throw new Error('missing label')
    const pathY = views.getEdge('e1')!.points[0]!.y
    expect(label.bounds.y + label.bounds.height / 2).toBeLessThan(pathY)
  })
})

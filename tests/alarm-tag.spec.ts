/**
 * Alarm tag variant + alarmPosition for skill third-title badges.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('Alarm tag third-title', () => {
  it('defaults to a topRight dot when style is omitted', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'A',
        x: 0,
        y: 0,
        w: 100,
        h: 64,
        alarms: [{ id: 'code', level: 'info', message: 'APP' }],
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const view = views.getNode('a')!
    const alarm = view.toPaintView(false, false).attachments.find(op => op.kind === 'alarm')
    expect(alarm).toMatchObject({ kind: 'alarm', variant: 'dot', text: 'APP' })
    expect(alarm!.bounds.x).toBeGreaterThan(view.bodyBounds.x + view.bodyBounds.width / 2)
  })

  it('places a tag inside the top-left for skill third-titles', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'lake',
        type: 'component',
        label: '湖仓底座',
        x: 560,
        y: 292,
        w: 208,
        h: 88,
        alarms: [{ id: 'code', level: 'error', message: 'LAKE' }],
        style: {
          alarmPosition: 'insideTopLeft',
          alarmVariant: 'tag',
          alarm: { color: '#bf4520', fontSize: 7, maxChars: 5 },
        },
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const view = views.getNode('lake')!
    const alarm = view.toPaintView(false, false).attachments.find(op => op.kind === 'alarm')
    expect(alarm).toMatchObject({
      kind: 'alarm',
      variant: 'tag',
      text: 'LAKE',
      color: '#bf4520',
      fontSize: 7,
    })
    expect(alarm!.bounds.x).toBeCloseTo(view.bodyBounds.x + 8)
    expect(alarm!.bounds.y).toBeCloseTo(view.bodyBounds.y + 8)
    expect(alarm!.bounds.height).toBe(12)
  })

  it('allows QUERY (5 chars) on tag without truncating', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'q',
        type: 'component',
        label: 'StarRocks',
        x: 0,
        y: 0,
        w: 168,
        h: 72,
        alarms: [{ id: 'code', level: 'info', message: 'QUERY' }],
        style: { alarmPosition: 'insideTopLeft', alarmVariant: 'tag' },
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const alarm = views.getNode('q')!.toPaintView(false, false).attachments.find(op => op.kind === 'alarm')
    expect(alarm).toMatchObject({ text: 'QUERY', variant: 'tag' })
  })
})

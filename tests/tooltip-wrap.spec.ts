/**
 * Tooltip text wrapping — long CJK stays inside the background box.
 */

import { describe, expect, it } from 'vitest'
import { layoutWrappedText } from '../src/ui/attachment/position.ts'
import { GraphScene } from '../src/model/scene.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('layoutWrappedText', () => {
  it('keeps a short line as one line', () => {
    const layout = layoutWrappedText('hello', 11, 160)
    expect(layout.lines).toEqual(['hello'])
  })

  it('wraps long CJK so each line fits the max width', () => {
    const text = '既消费又产生；双击进入九大平台查看数据管理标注训练评测仿真'
    const maxWidth = 160
    const layout = layoutWrappedText(text, 11, maxWidth)
    expect(layout.lines.length).toBeGreaterThan(1)
    for (const line of layout.lines) {
      expect(layoutWrappedText(line, 11, maxWidth).lines).toHaveLength(1)
      expect(layout.width).toBeLessThanOrEqual(maxWidth + 1)
    }
  })

  it('honors explicit newlines', () => {
    const layout = layoutWrappedText('第一行\n第二行', 11, 200)
    expect(layout.lines).toEqual(['第一行', '第二行'])
  })
})

describe('TooltipAttachment wrap', () => {
  it('emits multiple lines and a taller bounds for long tooltips', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'portal',
        label: '应用层',
        tooltip: '既消费又产生；双击进入九大平台查看数据管理、标注、训练、评测、仿真等平台详情',
        x: 0,
        y: 0,
        w: 100,
        h: 40,
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const tip = views.getNode('a')!.toPaintView(false, true)
      .overlayAttachments.find(op => op.kind === 'tooltip')
    expect(tip).toBeDefined()
    if (tip === undefined || tip.kind !== 'tooltip') return
    expect((tip.lines?.length ?? 0) > 1 || tip.text.includes('\n')).toBe(true)
    expect(tip.bounds.height).toBeGreaterThan(20)
    // Background width stays near the wrap budget (+ padding).
    expect(tip.bounds.width).toBeLessThanOrEqual(160 + 16 + 8)
  })
})

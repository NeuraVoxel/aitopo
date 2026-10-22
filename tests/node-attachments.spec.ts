/**
 * Attachment / dual-bounds NodeView behavior.
 */

import { describe, expect, it } from 'vitest'
import { GraphScene } from '../src/model/scene.ts'
import { getIcon } from '../src/ui/attachment/icon-registry.ts'
import { ViewSet } from '../src/ui/view-set.ts'

describe('Node attachments', () => {
  it('exposes bodyBounds and larger unionBounds when label2 is set', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'Primary',
        label2: 'Secondary',
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
    const view = views.getNode('a')!
    expect(view.bodyBounds).toEqual({ x: 0, y: 0, width: 100, height: 40 })
    expect(view.unionBounds.y).toBeLessThan(view.bodyBounds.y)
    expect(view.unionBounds.height).toBeGreaterThan(view.bodyBounds.height)
    expect(view.bounds).toEqual(view.unionBounds)
  })

  it('emits label/label2/icons attachment ops and no in-body text fields', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'VeryLongAgentLabelXYZ',
        label2: 'up',
        icon: 'server',
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
    const paint = views.getNode('a')!.toPaintView(false, false)
    expect('label' in paint).toBe(false)
    expect('meta' in paint).toBe(false)
    const kinds = paint.attachments.map(op => op.kind)
    expect(kinds).toContain('icons')
    expect(kinds).toContain('label')
    expect(kinds).toContain('label2')
    const label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe('VeryLongAgentLabelXYZ')
    const icons = paint.attachments.find(op => op.kind === 'icons')
    expect(icons && 'iconKey' in icons && icons.iconKey).toBe('server')
  })

  it('defaults networkId nodes to the subnetwork icon; explicit icon wins', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [
        { id: 'sub', type: 'team', label: 'Sub', networkId: 'net', x: 0, y: 0, w: 100, h: 40 },
        {
          id: 'named',
          type: 'team',
          label: 'Named',
          networkId: 'net',
          icon: 'server',
          x: 200,
          y: 0,
          w: 100,
          h: 40,
        },
        { id: 'plain', type: 'unit', label: 'Plain', x: 400, y: 0, w: 100, h: 40 },
      ],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const iconKeyOf = (id: string): string | undefined => {
      const icons = views.getNode(id)!.toPaintView(false, false).attachments
        .find(op => op.kind === 'icons')
      return icons && 'iconKey' in icons ? icons.iconKey : undefined
    }
    expect(iconKeyOf('sub')).toBe('subnetwork')
    expect(iconKeyOf('named')).toBe('server')
    expect(iconKeyOf('plain')).toBe('node')
  })

  it('does not truncate node labels by default; honors style.label.maxChars', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'VeryLongAgentLabelXYZ',
        style: { showIcon: false },
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
    let paint = views.getNode('a')!.toPaintView(false, false)
    let label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe('VeryLongAgentLabelXYZ')
    scene.apply({
      ops: [{ op: 'updateNode', id: 'a', patch: { style: { label: { maxChars: 8 } } } }],
    })
    views.markDirty('a')
    views.validateDirty(scene)
    paint = views.getNode('a')!.toPaintView(false, false)
    label = paint.attachments.find(op => op.kind === 'label')
    expect(label && 'text' in label && label.text).toBe('VeryLon…')
  })

  it('honors style.showIcon false to hide the default icon', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'A',
        style: { showIcon: false },
        x: 0,
        y: 0,
        w: 50,
        h: 50,
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).attachments.some(op => op.kind === 'icons')).toBe(false)
    scene.apply({ ops: [{ op: 'updateNode', id: 'a', patch: { style: { showIcon: true } } }] })
    views.markDirty('a')
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).attachments.some(op => op.kind === 'icons')).toBe(true)
  })

  it('honors ViewSet showNodeIconsDefault when style.showIcon omitted', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 0, y: 0, w: 50, h: 50 }],
      edges: [],
    })
    const views = new ViewSet()
    views.setShowNodeIconsDefault(false)
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).attachments.some(op => op.kind === 'icons')).toBe(false)
  })

  it('falls back unknown icon keys to node', () => {
    expect(getIcon('no-such-icon').key).toBe('node')
  })

  it('honors style.strokeDash on the node paint view', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'Gate',
        x: 0,
        y: 0,
        w: 100,
        h: 40,
        style: { strokeDash: [4, 4] },
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).strokeDash).toEqual([4, 4])
  })

  it('alarm attachment appears in scene ops', () => {
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
        h: 40,
        alarms: [{ id: 'al1', level: 'warn', message: '12' }],
      }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    const paint = views.getNode('a')!.toPaintView(false, false)
    const alarm = paint.attachments.find(op => op.kind === 'alarm')
    expect(alarm).toMatchObject({ kind: 'alarm', level: 'warn', text: '12' })
  })

  it('hover tooltip stays off union and only paints on overlay when hovered', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'A',
        tooltip: 'hello tip',
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
    const view = views.getNode('a')!
    // label below — union taller than body; tooltip (right, hover) excluded
    const withoutHover = view.toPaintView(false, false)
    expect(withoutHover.overlayAttachments).toHaveLength(0)
    expect(withoutHover.attachments.some(op => op.kind === 'tooltip')).toBe(false)

    const withHover = view.toPaintView(false, true)
    expect(withHover.overlayAttachments.some(op => op.kind === 'tooltip')).toBe(true)
    expect(withHover.attachments.some(op => op.kind === 'tooltip')).toBe(false)
  })

  it('always tooltip joins union and scene attachments', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'A',
        tooltip: 'pinned',
        style: { tooltipMode: 'always' },
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
    const view = views.getNode('a')!
    expect(view.unionBounds.width).toBeGreaterThan(view.bodyBounds.width)
    const paint = view.toPaintView(false, false)
    expect(paint.attachments.some(op => op.kind === 'tooltip')).toBe(true)
    expect(paint.overlayAttachments).toHaveLength(0)
  })

  it('defaults missing w/h to twaver 50x50 and applies updateNode size', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 10, y: 20 }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getNode('a')!.bodyBounds).toEqual({ x: 10, y: 20, width: 50, height: 50 })
    scene.apply({ ops: [{ op: 'updateNode', id: 'a', patch: { w: 80, h: 60 } }] })
    views.markDirty('a')
    views.validateDirty(scene)
    expect(views.getNode('a')!.bodyBounds).toEqual({ x: 10, y: 20, width: 80, height: 60 })
  })

  it('defaults paint alpha to 1 and applies style.alpha', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{ id: 'a', type: 'agent', label: 'A', x: 0, y: 0, w: 50, h: 50 }],
      edges: [],
    })
    const views = new ViewSet()
    views.rebuild(scene)
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).alpha).toBe(1)
    scene.apply({
      ops: [{ op: 'updateNode', id: 'a', patch: { style: { alpha: 0.4 } } }],
    })
    views.markDirty('a')
    views.validateDirty(scene)
    expect(views.getNode('a')!.toPaintView(false, false).alpha).toBe(0.4)
  })

  it('updateNode merges style one level and retargets icon', () => {
    const scene = new GraphScene()
    scene.load({
      version: 1,
      nodes: [{
        id: 'a',
        type: 'agent',
        label: 'A',
        icon: 'node',
        style: { labelPosition: 'bottom', label: { color: '#fff' } },
        x: 0,
        y: 0,
        w: 100,
        h: 40,
      }],
      edges: [],
    })
    scene.apply({
      ops: [{
        op: 'updateNode',
        id: 'a',
        patch: {
          icon: 'router',
          style: { labelPosition: 'top', select: { color: '#f00' } },
        },
      }],
    })
    const node = scene.nodes.get('a')!
    expect(node.icon).toBe('router')
    expect(node.style?.labelPosition).toBe('top')
    expect(node.style?.select?.color).toBe('#f00')
    expect(node.style?.label?.color).toBe('#fff')
  })
})

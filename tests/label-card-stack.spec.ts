/**
 * Default label principle: centered title, subtitle under title (Node + Group).
 */

import { describe, expect, it } from 'vitest'
import { LabelAttachment, Label2Attachment } from '../src/ui/attachment/label-attachment.ts'
import type { AttachmentValidateCtx } from '../src/ui/attachment/attachment.ts'

function nodeCtx(height: number): AttachmentValidateCtx {
  return {
    body: { x: 0, y: 0, width: 208, height },
    node: {
      id: 'lake',
      type: 'portal',
      label: '湖仓底座',
      label2: 'Paimon ODS→ADS',
      style: {
        label: { fontSize: 13 },
        label2: { fontSize: 9 },
      },
    },
  }
}

function groupCtx(height: number): AttachmentValidateCtx {
  return {
    body: { x: 0, y: 0, width: 300, height },
    group: {
      id: 'g-apps',
      label: '应用平台',
      label2: '9 platforms',
      memberIds: [],
      style: {
        label: { fontSize: 13 },
        label2: { fontSize: 9 },
      },
    },
  }
}

function gapBetween(ctx: AttachmentValidateCtx): number {
  const title = new LabelAttachment()
  const subtitle = new Label2Attachment()
  title.validate(ctx)
  subtitle.validate(ctx)
  const t = title.toPaintOp(false)
  const s = subtitle.toPaintOp(false)
  if (t?.kind !== 'label' || s?.kind !== 'label2') throw new Error('missing ops')
  return s.bounds.y - (t.bounds.y + t.bounds.height)
}

describe('default title / subtitle principle', () => {
  it('stacks subtitle under title on nodes without explicit positions', () => {
    const gap = gapBetween(nodeCtx(88))
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(4)
  })

  it('applies the same stack to groups', () => {
    const gap = gapBetween(groupCtx(120))
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(4)
  })

  it('does not stretch the gap when the body grows taller', () => {
    expect(gapBetween(nodeCtx(120))).toBeCloseTo(gapBetween(nodeCtx(64)), 5)
  })
})

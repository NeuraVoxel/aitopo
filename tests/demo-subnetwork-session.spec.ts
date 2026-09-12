import { describe, expect, it, vi } from 'vitest'
import {
  resetDemoOnSubNetworkChanged,
  runDemoHistoryStep,
} from '../demo/lib/subnetwork-session.ts'
import { PatchHistory } from '../src/protocol/patch-history.ts'
import { applyPatch } from '../src/protocol/patch.ts'
import { parseDocument } from '../src/protocol/parse.ts'

describe('resetDemoOnSubNetworkChanged', () => {
  it('clears PatchHistory and engine selection on subNetworkChanged', () => {
    let doc = parseDocument({
      version: 1,
      nodes: [{ id: 'parent', type: 'team', label: 'Team', x: 0, y: 0 }],
      edges: [],
    })
    const history = new PatchHistory(
      (patch) => { doc = applyPatch(doc, patch) },
      () => doc,
    )
    history.pushAndApply({
      ops: [{ op: 'updateNode', id: 'parent', patch: { label: 'Renamed' } }],
    })
    expect(history.undo()).toBe(true)
    expect(history.redo()).toBe(true)

    let selectedIds: readonly string[] = ['parent']
    const selected = resetDemoOnSubNetworkChanged({
      history,
      getSelectedIds: () => selectedIds,
      setSelection: (ids) => { selectedIds = [...ids] },
    })

    expect(selected).toEqual([])
    expect(selectedIds).toEqual([])
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
  })

  it('clears selection when history is absent (Observe)', () => {
    let selectedIds: readonly string[] = ['parent']
    const selected = resetDemoOnSubNetworkChanged({
      history: null,
      getSelectedIds: () => selectedIds,
      setSelection: (ids) => { selectedIds = [...ids] },
    })
    expect(selected).toEqual([])
    expect(selectedIds).toEqual([])
  })
})

describe('runDemoHistoryStep', () => {
  it('returns apply error text instead of throwing', () => {
    const onApplied = vi.fn()
    const message = runDemoHistoryStep(() => {
      throw new Error('apply failed')
    }, onApplied)
    expect(message).toBe('apply failed')
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('skips empty stacks and reports success without a message', () => {
    const onApplied = vi.fn()
    expect(runDemoHistoryStep(() => false, onApplied)).toBeUndefined()
    expect(onApplied).not.toHaveBeenCalled()
    expect(runDemoHistoryStep(() => true, onApplied)).toBeUndefined()
    expect(onApplied).toHaveBeenCalledTimes(1)
  })
})

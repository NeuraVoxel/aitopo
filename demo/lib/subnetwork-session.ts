/**
 * Demo session reset on `subNetworkChanged`.
 * Scene selection and PatchHistory survive enter/exit; parent ids and
 * parent-network inverses must not remain for PropertyPanel / Undo.
 */

export interface DemoHistory {
  clear(): void
}

export interface DemoSubNetworkHost {
  readonly history: DemoHistory | null
  getSelectedIds(): readonly string[]
  setSelection(ids: readonly string[]): void
}

/**
 * Clear history stacks and engine selection, then return the live selection.
 * @param host - current demo Network + optional PatchHistory.
 * @returns selected ids after `setSelection([])`.
 */
export function resetDemoOnSubNetworkChanged(host: DemoSubNetworkHost): readonly string[] {
  host.history?.clear()
  host.setSelection([])
  return [...host.getSelectedIds()]
}

/**
 * Run undo/redo without throwing into the React event handler.
 * @param step - `PatchHistory.undo` / `redo` (false when the stack is empty).
 * @param onApplied - depth/flag update after a successful apply.
 * @returns apply error text, or undefined when the step was skipped or succeeded.
 */
export function runDemoHistoryStep(
  step: () => boolean,
  onApplied: () => void,
): string | undefined {
  try {
    if (!step()) return undefined
    onApplied()
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

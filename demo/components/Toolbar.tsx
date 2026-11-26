import { Fragment } from 'react'
import type { DemoMode, NetworkDemoApi } from '../hooks/useNetworkDemo.ts'

export type ToolbarProps = Pick<
  NetworkDemoApi,
  | 'mode'
  | 'debug'
  | 'canUndo'
  | 'canRedo'
  | 'setMode'
  | 'setDebug'
  | 'undo'
  | 'redo'
  | 'fitContent'
>

const MODES: readonly { id: DemoMode; label: string; group: 'observe' | 'edit' }[] = [
  { id: 'observe', label: 'Observe', group: 'observe' },
  { id: 'edit', label: 'Edit', group: 'edit' },
  { id: 'create-node', label: 'Create Node', group: 'edit' },
  { id: 'create-link', label: 'Create Link', group: 'edit' },
  { id: 'create-path', label: 'Create Path', group: 'edit' },
]

/** Interaction modes, history, and Debug, visually grouped by concern. */
export function Toolbar({
  mode,
  debug,
  canUndo,
  canRedo,
  setMode,
  setDebug,
  undo,
  redo,
  fitContent,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Interaction">
      {MODES.map((item, index) => {
        const previous = MODES[index - 1]
        return (
          <Fragment key={item.id}>
            {previous !== undefined && previous.group !== item.group && (
              <span className="toolbar-sep" aria-hidden="true" />
            )}
            <button
              type="button"
              className={['toolbar-btn', mode === item.id ? 'is-active' : ''].filter(Boolean).join(' ')}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          </Fragment>
        )
      })}
      <span className="toolbar-sep" aria-hidden="true" />
      <button type="button" className="toolbar-btn" disabled={!canUndo} onClick={undo}>
        Undo
      </button>
      <button type="button" className="toolbar-btn" disabled={!canRedo} onClick={redo}>
        Redo
      </button>
      <span className="toolbar-sep" aria-hidden="true" />
      <button
        type="button"
        className="toolbar-btn"
        title="Zoom to fit content"
        onClick={fitContent}
      >
        Fit
      </button>
      <button
        type="button"
        className={['toolbar-btn', debug ? 'is-active' : ''].filter(Boolean).join(' ')}
        aria-pressed={debug}
        onClick={() => setDebug(!debug)}
      >
        {debug ? 'Debug ✓' : 'Debug'}
      </button>
    </div>
  )
}

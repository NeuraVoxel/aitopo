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
  | 'enterSubNetwork'
  | 'exitSubNetwork'
>

const MODES: readonly { id: DemoMode; label: string }[] = [
  { id: 'observe', label: 'Observe' },
  { id: 'edit', label: 'Edit' },
  { id: 'create-node', label: 'Create Node' },
  { id: 'create-link', label: 'Create Link' },
]

/** Interaction modes, history, Debug, and SubNetwork enter/exit. */
export function Toolbar({
  mode,
  debug,
  canUndo,
  canRedo,
  setMode,
  setDebug,
  undo,
  redo,
  enterSubNetwork,
  exitSubNetwork,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Interaction">
      {MODES.map(item => (
        <button
          key={item.id}
          type="button"
          className={['toolbar-btn', mode === item.id ? 'is-active' : ''].filter(Boolean).join(' ')}
          aria-pressed={mode === item.id}
          onClick={() => setMode(item.id)}
        >
          {item.label}
        </button>
      ))}
      <span className="toolbar-sep" aria-hidden="true" />
      <button type="button" className="toolbar-btn" disabled={!canUndo} onClick={undo}>
        Undo
      </button>
      <button type="button" className="toolbar-btn" disabled={!canRedo} onClick={redo}>
        Redo
      </button>
      <button
        type="button"
        className={['toolbar-btn', debug ? 'is-active' : ''].filter(Boolean).join(' ')}
        aria-pressed={debug}
        onClick={() => setDebug(!debug)}
      >
        {debug ? 'Debug ✓' : 'Debug'}
      </button>
      <span className="toolbar-sep" aria-hidden="true" />
      <button
        type="button"
        className="toolbar-btn"
        title="Enter SubNetwork team-a"
        onClick={() => enterSubNetwork('team-a')}
      >
        Enter team-a
      </button>
      <button
        type="button"
        className="toolbar-btn"
        title="Exit current SubNetwork"
        onClick={exitSubNetwork}
      >
        Exit subnet
      </button>
    </div>
  )
}

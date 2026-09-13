import { useCallback, useEffect, useRef, useState } from 'react'
import type { GraphDocument } from '../../src/protocol/types.ts'
import type { DemoMode } from '../hooks/useNetworkDemo.ts'
import {
  buildSessionDocument,
  fetchDshSessions,
  parseDshWebUrl,
  summarizeSessions,
} from '../lib/dsh-sessions.ts'

export interface SessionSourceBarProps {
  /** Current interaction mode; a change remounts the network (placeholder returns). */
  readonly mode: DemoMode
  readonly onLoadDocument: (doc: GraphDocument) => void
}

const STORAGE_KEY = 'aitopo-demo.dsh-web-url'

type LoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ok'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string }

/**
 * Data source bar for the live DSH Session sample: paste the URL printed by
 * `dsh web` (with `?token=`), Load fetches `session/list` through the
 * dev-server proxy and installs the workspace-grouped document.
 */
export function SessionSourceBar({ mode, onLoadDocument }: SessionSourceBarProps) {
  const [value, setValue] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async (target: string) => {
    setState({ kind: 'loading' })
    try {
      const sessions = await fetchDshSessions(target)
      if (!mountedRef.current) return
      localStorage.setItem(STORAGE_KEY, target)
      onLoadDocument(buildSessionDocument(sessions))
      setState({ kind: 'ok', message: summarizeSessions(sessions) })
    } catch (error) {
      if (!mountedRef.current) return
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [onLoadDocument])

  // Auto-load the remembered URL when the sample activates, and again after a
  // mode switch (the network remounts and reloads the placeholder document).
  useEffect(() => {
    if (parseDshWebUrl(value) === undefined) return
    void load(value)
    // Re-run only on remount triggers; `value`/`load` are captured on purpose.
  }, [mode])

  const canLoad = parseDshWebUrl(value) !== undefined && state.kind !== 'loading'

  return (
    <div className="source-bar" role="region" aria-label="DSH web data source">
      <label className="source-bar-label" htmlFor="dsh-web-url">dsh web</label>
      <input
        id="dsh-web-url"
        className="source-bar-input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="dsh web: http://127.0.0.1:3081/?token=…"
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && canLoad) void load(value)
        }}
      />
      <button type="button" className="toolbar-btn" disabled={!canLoad} onClick={() => void load(value)}>
        {state.kind === 'loading' ? 'Loading…' : 'Load'}
      </button>
      {state.kind === 'loading' && (
        <span className="source-bar-status">Fetching sessions…</span>
      )}
      {(state.kind === 'ok' || state.kind === 'error') && (
        <span className={['source-bar-status', state.kind === 'error' ? 'is-error' : ''].join(' ').trim()}>
          {state.message}
        </span>
      )}
    </div>
  )
}

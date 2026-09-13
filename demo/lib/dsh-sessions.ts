import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '../../src/protocol/types.ts'

/**
 * DSH web session source: parse a pasted `dsh web` URL, fetch the live session
 * list through the dev-server proxy (`demo/dsh-web-proxy.ts`), and fold it into
 * a workspace-grouped GraphDocument. Wire shapes mirror the dsh browser
 * client: one `session/list` call returns every field this view needs.
 */

/** Fields read from each `session/list` item (see dsh SessionSummary). */
export interface DshSessionSummary {
  readonly sessionId: string
  readonly updatedAt?: number
  readonly running?: boolean
  readonly blank?: boolean
  readonly origin?: string
  readonly parentSessionId?: string
  readonly cwd?: string
  readonly projections?: {
    readonly values?: {
      readonly title?: string | null
      readonly sessionStats?: { readonly turns?: number; readonly steps?: number } | null
    }
  }
}

/** Parsed dsh web address: page origin plus the one-time launch token. */
export interface DshWebTarget {
  /** Origin + path without the token query, e.g. `http://127.0.0.1:3081/`. */
  readonly origin: string
  readonly token: string | undefined
}

const URL_PATTERN = /https?:\/\/\S+/

/**
 * Accepts the URL as printed by `dsh web` with or without a `dsh web: `
 * prefix, and tolerates surrounding prose; returns undefined when no http(s)
 * URL is present.
 */
export function parseDshWebUrl(input: string): DshWebTarget | undefined {
  const match = URL_PATTERN.exec(input.trim())
  if (match === null) return undefined
  let parsed: URL
  try {
    parsed = new URL(match[0])
  } catch {
    return undefined
  }
  const token = parsed.searchParams.get('token') ?? undefined
  parsed.search = ''
  parsed.hash = ''
  return { origin: parsed.toString(), token }
}

/** Local shape of the browser-client RPC envelope (dsh `server-response`). */
interface DshListEnvelope {
  readonly type?: string
  readonly result?: {
    readonly ok?: boolean
    readonly value?: { readonly items?: readonly DshSessionSummary[] }
    readonly error?: { readonly message?: string }
  }
}

/** Fetches the live session list through the demo dev-server proxy. */
export async function fetchDshSessions(url: string): Promise<readonly DshSessionSummary[]> {
  const response = await fetch('/dsh-web/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error(`dsh web proxy returned ${response.status} (non-JSON)`)
  }
  const envelope = payload as { error?: string } & DshListEnvelope
  if (envelope.error !== undefined) throw new Error(envelope.error)
  if (envelope.result?.ok !== true) {
    throw new Error(envelope.result?.error?.message ?? 'dsh web gateway rejected session/list')
  }
  return envelope.result.value?.items ?? []
}

function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return '(no workspace)'
  const trimmed = cwd.replace(/\/+$/, '')
  const slash = trimmed.lastIndexOf('/')
  return slash >= 0 ? trimmed.slice(slash + 1) || trimmed : trimmed
}

function formatTurns(turns: number): string {
  return turns === 1 ? '1 turn' : `${turns} turns`
}

function sessionTurns(session: DshSessionSummary): number {
  return session.projections?.values?.sessionStats?.turns ?? 0
}

function sessionStatus(session: DshSessionSummary): string {
  if (session.running === true) return 'running'
  if (session.blank === true) return 'idle'
  return 'done'
}

function sessionTitle(session: DshSessionSummary): string {
  const title = session.projections?.values?.title
  return title === undefined || title === null || title === '' ? '(untitled)' : title
}

function sessionTooltip(session: DshSessionSummary): string {
  const stats = session.projections?.values?.sessionStats
  const updated = session.updatedAt === undefined
    ? 'unknown'
    : new Date(session.updatedAt).toLocaleString()
  return [
    session.sessionId,
    session.cwd ?? '(no cwd)',
    `updated: ${updated}`,
    `turns: ${sessionTurns(session)} · steps: ${stats?.steps ?? 0}`,
  ].join('\n')
}

/**
 * Sessions per workspace card, most recently active workspace first. Bands
 * tile in a grid (at most GROUP_COLS per row); inside a band, sessions tile
 * in their own matrix (at most GRID_COLS per row).
 */
const GRID_COLS = 3
const GROUP_COLS = 2
const CELL_DX = 160
const CELL_DY = 110
const GROUP_GAP_X = 70
const GROUP_GAP_Y = 70
/** Footer room under a band for the workspace name / count labels (30px font). */
const LABEL_SPACE = 48
const GROUP_PADDING = 14
const X0 = 90
const Y0 = 90
/** Column pitch between band slots; the widest band is GRID_COLS cells. */
const GROUP_DX = GRID_COLS * CELL_DX + GROUP_GAP_X

function workspaceGroups(sessions: readonly DshSessionSummary[]): Map<string, DshSessionSummary[]> {
  const groups = new Map<string, DshSessionSummary[]>()
  for (const session of sessions) {
    const key = session.cwd ?? ''
    const bucket = groups.get(key)
    if (bucket === undefined) groups.set(key, [session])
    else bucket.push(session)
  }
  return new Map(
    [...groups.entries()].sort((a, b) => {
      const latest = (rows: readonly DshSessionSummary[]): number =>
        Math.max(...rows.map(row => row.updatedAt ?? 0))
      return latest(b[1]) - latest(a[1])
    }),
  )
}

/**
 * Folds live `session/list` items into one document: an expanded group band
 * per workspace cwd, one node per session (label2 carries the turn count), and
 * parent→child edges for subagent sessions.
 */
export function buildSessionDocument(sessions: readonly DshSessionSummary[]): GraphDocument {
  if (sessions.length === 0) {
    return {
      version: 1,
      meta: { title: 'DSH Sessions', kind: 'topology' },
      nodes: [{
        id: 'dsh-empty',
        type: 'client',
        label: 'No sessions',
        label2: 'dsh web store is empty',
        status: 'idle',
        tooltip: 'The connected dsh web instance reports no sessions yet.',
        x: 120,
        y: 120,
      }],
      edges: [],
      groups: [],
    }
  }

  const byId = new Map(sessions.map(session => [session.sessionId, session]))
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const groups: GraphGroup[] = []

  let cursorX = X0
  let cursorY = Y0
  let rowHeight = 0
  let bandsInRow = 0
  for (const [cwd, members] of workspaceGroups(sessions)) {
    const groupId = `ws:${cwd === '' ? 'none' : cwd}`
    nodes.push(...members.map((session, index) => {
      const subagent = session.origin === 'subagent' || session.parentSessionId !== undefined
      const turns = sessionTurns(session)
      return {
        id: session.sessionId,
        type: subagent ? 'subagent' : 'session',
        label: sessionTitle(session),
        status: sessionStatus(session),
        tooltip: sessionTooltip(session),
        // Warm alarm badge carries the turn count (badge text caps at 3 chars,
        // so the message is the bare number; the tooltip spells it out).
        // Zero-turn sessions stay badge-free.
        ...(turns > 0 ? { alarms: [{ id: 'turns', level: 'warn' as const, message: String(turns) }] } : {}),
        groupId,
        data: {
          sessionId: session.sessionId,
          cwd: session.cwd ?? null,
          turns,
          steps: session.projections?.values?.sessionStats?.steps ?? 0,
          running: session.running === true,
        },
        x: cursorX + (index % GRID_COLS) * CELL_DX,
        y: cursorY + Math.floor(index / GRID_COLS) * CELL_DY,
      }
    }))
    for (const session of members) {
      const parent = session.parentSessionId
      if (parent === undefined || !byId.has(parent)) continue
      edges.push({
        id: `sub:${session.sessionId}`,
        from: parent,
        to: session.sessionId,
        kind: 'lifecycle',
        label: 'subagent',
      })
    }
    groups.push({
      id: groupId,
      label: workspaceLabel(cwd === '' ? undefined : cwd),
      label2: `${members.length} ${members.length === 1 ? 'session' : 'sessions'} · ${formatTurns(
        members.reduce((sum, session) => sum + sessionTurns(session), 0),
      )}`,
      tooltip: cwd === '' ? 'Sessions without a working directory' : cwd,
      memberIds: members.map(session => session.sessionId),
      expanded: true,
      style: {
        labelPosition: 'bottom',
        label2Position: 'top',
        label: { fontSize: 30 },
        padding: GROUP_PADDING,
      },
    })
    rowHeight = Math.max(rowHeight, Math.ceil(members.length / GRID_COLS) * CELL_DY)
    bandsInRow += 1
    cursorX += GROUP_DX
    if (bandsInRow === GROUP_COLS) {
      cursorX = X0
      cursorY += rowHeight + LABEL_SPACE + GROUP_GAP_Y
      bandsInRow = 0
      rowHeight = 0
    }
  }

  return {
    version: 1,
    meta: { title: 'DSH Sessions', kind: 'topology' },
    nodes,
    edges,
    groups,
  }
}

/** Session/turn totals for the source bar status line. */
export function summarizeSessions(sessions: readonly DshSessionSummary[]): string {
  const workspaces = new Set(sessions.map(session => session.cwd ?? '')).size
  const turns = sessions.reduce((sum, session) => sum + sessionTurns(session), 0)
  return `${workspaces} ${workspaces === 1 ? 'workspace' : 'workspaces'} · `
    + `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} · `
    + `${turns} turns total`
}

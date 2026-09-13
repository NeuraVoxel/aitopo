import { describe, expect, it } from 'vitest'
import { parseDocument } from '../src/protocol/index.ts'
import {
  buildSessionDocument,
  parseDshWebUrl,
  summarizeSessions,
  type DshSessionSummary,
} from '../demo/lib/dsh-sessions.ts'

function session(overrides: Partial<DshSessionSummary> = {}): DshSessionSummary {
  return {
    sessionId: 'session-x',
    updatedAt: 1_700_000_000_000,
    running: false,
    blank: false,
    cwd: '/work/aitopo',
    projections: { values: { title: 'Demo title', sessionStats: { turns: 3, steps: 9 } } },
    ...overrides,
  }
}

describe('parseDshWebUrl', () => {
  it('accepts the URL as printed by dsh web with its prefix', () => {
    const target = parseDshWebUrl('dsh web: http://127.0.0.1:3081/?token=abc$DEF')
    expect(target).toBeDefined()
    expect(target!.origin).toBe('http://127.0.0.1:3081/')
    expect(target!.token).toBe('abc$DEF')
  })

  it('accepts a bare URL and drops unrelated query and hash', () => {
    const target = parseDshWebUrl('http://localhost:3080/?token=tok&x=1#page')
    expect(target!.origin).toBe('http://localhost:3080/')
    expect(target!.token).toBe('tok')
  })

  it('accepts a token-less origin (surfaced later as an auth error)', () => {
    const target = parseDshWebUrl('http://127.0.0.1:3081/')
    expect(target!.token).toBeUndefined()
  })

  it('rejects input without an http(s) URL', () => {
    expect(parseDshWebUrl('')).toBeUndefined()
    expect(parseDshWebUrl('dsh web: 127.0.0.1:3081 token=abc')).toBeUndefined()
    expect(parseDshWebUrl('ftp://127.0.0.1:3081/')).toBeUndefined()
  })
})

describe('buildSessionDocument', () => {
  it('groups sessions by workspace cwd with turn counts and expanded bands', () => {
    const doc = parseDocument(buildSessionDocument([
      session({ sessionId: 's1', cwd: '/work/aitopo' }),
      session({ sessionId: 's2', cwd: '/work/aitopo', blank: true, projections: { values: {} } }),
      session({ sessionId: 's3', cwd: '/work/cordis', updatedAt: 1_800_000_000_000 }),
    ]))

    expect(doc.nodes).toHaveLength(3)
    expect(doc.groups).toHaveLength(2)
    // Most recently active workspace first.
    expect(doc.groups!.map(group => group.label)).toEqual(['cordis', 'aitopo'])
    expect(doc.groups!.every(group => group.expanded === true)).toBe(true)
    for (const group of doc.groups!) {
      const members = doc.nodes.filter(node => node.groupId === group.id)
      expect(group.memberIds).toEqual(members.map(node => node.id))
    }

    const s1 = doc.nodes.find(node => node.id === 's1')
    expect(s1?.label).toBe('Demo title')
    expect(s1?.status).toBe('done')
    // Turn count rides a warm alarm badge (bare number — the badge caps at 3 chars).
    expect(s1?.alarms).toEqual([{ id: 'turns', level: 'warn', message: '3' }])
    expect(s1?.label2).toBeUndefined()
    const s2 = doc.nodes.find(node => node.id === 's2')
    expect(s2?.label).toBe('(untitled)')
    // Zero-turn sessions carry no alarm badge.
    expect(s2?.alarms).toBeUndefined()
    expect(s2?.status).toBe('idle')
    // Workspace name sits centered under the band in 30px; the count line
    // sits centered above it.
    expect(doc.groups![0]!.style?.labelPosition).toBe('bottom')
    expect(doc.groups![0]!.style?.label2Position).toBe('top')
    expect(doc.groups![0]!.style?.label?.fontSize).toBe(30)
    expect(doc.nodes.every(node => node.x !== undefined && node.y !== undefined)).toBe(true)
  })

  it('tiles bands two per row and their sessions three per row', () => {
    const sessions: DshSessionSummary[] = []
    for (let w = 0; w < 5; w++) {
      for (let s = 0; s < 7; s++) {
        sessions.push(session({ sessionId: `w${w}s${s}`, cwd: `/work/ws${w}` }))
      }
    }
    const doc = parseDocument(buildSessionDocument(sessions))
    const nodeY = (id: string): number => {
      const node = doc.nodes.find(n => n.id === id)
      if (node?.y === undefined) throw new Error(`missing node ${id}`)
      return node.y
    }

    // Inside a band: at most 3 sessions share a matrix row.
    for (const group of doc.groups ?? []) {
      const perRow = new Map<number, number>()
      for (const id of group.memberIds) {
        perRow.set(nodeY(id), (perRow.get(nodeY(id)) ?? 0) + 1)
      }
      expect(Math.max(...perRow.values())).toBeLessThanOrEqual(3)
    }

    // Bands tile two per row: 5 workspaces → 2 + 2 + 1 across three band rows.
    const bandsPerRow = new Map<number, number>()
    for (const group of doc.groups ?? []) {
      const top = Math.min(...group.memberIds.map(nodeY))
      bandsPerRow.set(top, (bandsPerRow.get(top) ?? 0) + 1)
    }
    expect(Math.max(...bandsPerRow.values())).toBeLessThanOrEqual(2)
    expect(bandsPerRow.size).toBe(3)
  })

  it('marks running sessions and links subagents to their parent', () => {
    const doc = parseDocument(buildSessionDocument([
      session({ sessionId: 'parent', running: true }),
      session({
        sessionId: 'child',
        origin: 'subagent',
        parentSessionId: 'parent',
      }),
      session({
        sessionId: 'orphan',
        origin: 'subagent',
        parentSessionId: 'session-missing-from-list',
      }),
    ]))

    expect(doc.nodes.find(node => node.id === 'parent')?.status).toBe('running')
    expect(doc.nodes.find(node => node.id === 'child')?.type).toBe('subagent')
    // Only parents present in the list get an edge; the orphan gets none.
    expect(doc.edges.map(edge => edge.id)).toEqual(['sub:child'])
    expect(doc.edges[0]).toMatchObject({ from: 'parent', to: 'child' })
  })

  it('parks sessions without a cwd in a labeled fallback band', () => {
    const doc = parseDocument(buildSessionDocument([
      session({ sessionId: 'adrift', cwd: undefined }),
    ]))
    expect(doc.groups!.map(group => group.label)).toEqual(['(no workspace)'])
    expect(doc.groups![0]!.memberIds).toEqual(['adrift'])
  })

  it('renders a single explanatory node for an empty store', () => {
    const doc = parseDocument(buildSessionDocument([]))
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0]!.label).toBe('No sessions')
    expect(doc.groups).toHaveLength(0)
  })
})

describe('summarizeSessions', () => {
  it('counts workspaces, sessions, and total turns', () => {
    const summary = summarizeSessions([
      session({ sessionId: 's1', cwd: '/a' }),
      session({ sessionId: 's2', cwd: '/a', projections: { values: { sessionStats: { turns: 4, steps: 4 } } } }),
      session({ sessionId: 's3', cwd: '/b' }),
    ])
    expect(summary).toBe('2 workspaces · 3 sessions · 10 turns total')
  })
})

# Agent Note: DSH Session live demo sample

Status: implemented

## Problem

Every demo sample is a hand-authored or recorded static `GraphDocument`. There
was no way to see the engine render *real* DSH data, and answering "how are
sessions spread across my workspaces, and how many turns did each one run"
required opening the dsh web UI. The dsh web service exposes the data over an
authenticated HTTP API on the user's machine, but a browser page served from the
demo dev server cannot call it directly: the `/api` trust fence rejects
`sec-fetch-site: cross-site` requests and Origin/Host mismatches, and responses
carry no CORS headers.

## Decision

The `dsh` demo group gains a `dsh-session` sample that loads live data from a
user-supplied dsh web URL (e.g. `dsh web: http://127.0.0.1:3081/?token=…`).

**Data source.** Two reads cover the whole feature. `POST /api/session/list`
with the browser-client envelope
`{type:'client-request', rpcId, method:'session/list', payload:{args:{_request:{}}}}`
returns every session with `cwd` (the workspace grouping key — the same key the
session store and the web UI use to group sessions), the `title` and
`sessionStats` projections (`turns`, `steps`), `running`, `blank`, and
`parentSessionId`/`origin` for subagent sessions. The archived-session set
lives only in the `workspace/follow` stream baseline, so the dev-server proxy
additionally opens the gateway's WebSocket mux (`/api/remote.mux`, `ws` dev
dependency) with the minted cookie, reads the first baseline frame's
`archivedSessionIds`, and cancels; any mux failure degrades to an empty set —
archive rendering is cosmetic and a missing set can only under-report, never
mis-gray.

**Transport.** The demo's Vite dev server exposes `POST /dsh-web/sessions`
(`demo/dsh-web-proxy.ts`, wired in `demo/vite.config.ts`). The browser posts
`{url}`; server-side Node code parses the URL (tolerantly — a `dsh web: `
prefix or bare origin is accepted), exchanges `?token=` for the auth cookie via
`GET /?token=…`, then calls `session/list` with that cookie and reads the mux
baseline (see Data source), answering the browser with
`{sessionList, archivedSessionIds}`. Server-side requests carry no
`Origin`/`Sec-Fetch-Site` headers, so they pass the trust fence; the proxy is
dev-server-only code and never ships in the library. The token is used only
for the one-time cookie mint and is not logged.

**Live samples.** `DemoSample` gains an optional `live` marker
(`'dsh-sessions'` today). The static `document` is the pre-load placeholder
canvas; when the active sample is live, `App` renders
`SessionSourceBar` (URL input + Load/Refresh + inline status) above the canvas.
The bar persists the last working URL in `localStorage` and auto-loads on sample
activation and mode switches (mode switches remount the Network, which would
otherwise fall back to the placeholder). Fetch results go through
`buildSessionDocument` (`demo/lib/dsh-sessions.ts`) and are installed with the
new `useNetworkDemo().loadDocument(doc)` — an in-place `network.load` plus fit,
no remount.

**Document shape.** One expanded group per workspace `cwd` (label = path
basename centered below the band in 30px, session/turn totals centered above
it, tooltip = full path), one node per session (label = title projection or
`(untitled)`, turn count as a warm `warn`-level alarm badge whose text is the
bare number — only sessions with at least one turn carry the badge; the engine
badge caps at three characters, the tooltip spells
out `turns/steps`; status `running`/`idle`/`done` mapped from `running`/
`blank`), and `parent → child` edges for subagent sessions. Archived sessions
render muted: `cold` fill plus 0.55 alpha and an `archived` tooltip line. Bands
tile two per row and sessions inside a band tile in their own ≤3-wide matrix
(constants in `demo/lib/dsh-sessions.ts`); workspaces sort by most recent
activity; sessions without `cwd` land in a `(no workspace)` group; an empty
store renders a single explanatory node.

## Alternatives considered

- **Direct browser fetch with CORS** — rejected: would require dsh web to serve
  CORS headers and relax its trust fence; changing the product's security
  posture for a demo is wrong.
- **`workspace/follow` stream for real workspace titles** — rejected: WebSocket
  mux protocol for marginal gain (cwd is the same grouping key); unary
  `session/list` already carries everything the view needs.
- **Generated static sample refreshed by a script (like `dsh-boot`)** —
  rejected: the point of this sample is *live* data; a recording goes stale the
  moment a session is created.
- **Async loader extension on `DemoSample`** — rejected: the placeholder +
  `loadDocument` split keeps the registry synchronous and the sample listed
  like any other; only the source bar knows about fetching.

## Consequences

The demo now depends on a running dsh web instance to show real data — without
one it stays on the placeholder with an inline error, and `pnpm test` never
touches the network (transport code is exercised only through pure URL-parsing
and document-building units). The proxy widens the dev server into a
loopback-fetch forwarder; it is restricted to `http:`/`https:` inputs and
dev-server lifetime, and the token never leaves the local machine beyond the
dsh web origin itself. `DemoSample.live` is a demo-side concept only — the
engine contract (`GraphDocument`, patches) is unchanged.

## Testing

`tests/dsh-session-demo.spec.ts` covers URL parsing (prefixed/plain/rejected),
document building (workspace grouping, turn labels, status mapping, subagent
edge, no-cwd fallback, empty state, positioned nodes), and the placeholder
parsing through `parseDocument`. `tests/demo-registry.spec.ts` pins the dsh
group order `['dsh-boot', 'dsh-event-topo', 'dsh-session']`. End-to-end was
verified against a locally booted `dsh web` on 127.0.0.1:3081 reading the real
`~/.dsh/sessions` store.

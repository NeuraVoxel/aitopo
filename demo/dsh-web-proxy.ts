import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { parseDshWebUrl } from './lib/dsh-sessions.ts'

/**
 * Dev-server forwarder for the DSH Session demo sample. The browser cannot
 * call dsh web directly: its `/api` trust fence rejects cross-site fetches
 * (`sec-fetch-site`, Origin/Host mismatch) and responses carry no CORS
 * headers. Server-side requests carry no browser fingerprint headers, so this
 * proxy exchanges the pasted `?token=` for the auth cookie and issues the
 * `session/list` call on the page's behalf.
 *
 * Dev-server-only code — never part of the shipped library.
 */

export const DSH_SESSIONS_PROXY_PATH = '/dsh-web/sessions'

const REQUEST_TIMEOUT_MS = 10_000
const BODY_LIMIT_BYTES = 8_192

interface ProxyRequestBody {
  readonly url?: unknown
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).byteLength
    if (size > BODY_LIMIT_BYTES) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** One-time `?token=` → auth-cookie exchange against the dsh web origin. */
async function mintAuthCookie(target: { readonly origin: string; readonly token: string | undefined }): Promise<string> {
  if (target.token === undefined) return ''
  const mintUrl = new URL(`?token=${encodeURIComponent(target.token)}`, target.origin)
  const response = await fetch(mintUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const cookies = response.headers.getSetCookie().map(cookie => cookie.split(';')[0] ?? '')
  return cookies.filter(cookie => cookie !== '').join('; ')
}

/** Relays the dsh `session/list` RPC envelope, or throws a user-readable error. */
async function callSessionList(target: { origin: string; cookie: string }): Promise<unknown> {
  const endpoint = new URL('api/session/list', target.origin)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(target.cookie !== '' ? { cookie: target.cookie } : {}),
    },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `aitopo-demo-${Date.now()}`,
      method: 'session/list',
      payload: { args: { _request: {} } },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`dsh web responded ${response.status}: ${text.slice(0, 200)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`dsh web returned non-JSON (${response.status})`)
  }
}

function registerMiddleware(server: ViteDevServer): void {
  server.middlewares.use(DSH_SESSIONS_PROXY_PATH, (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    void (async () => {
      try {
        const body: ProxyRequestBody = JSON.parse(await readRequestBody(req)) as ProxyRequestBody
        if (typeof body.url !== 'string') {
          sendJson(res, 400, { error: 'missing "url" field' })
          return
        }
        const target = parseDshWebUrl(body.url)
        if (target === undefined) {
          sendJson(res, 400, { error: 'no http(s) URL found in the input' })
          return
        }
        const cookie = await mintAuthCookie(target)
        const envelope = await callSessionList({ origin: target.origin, cookie })
        sendJson(res, 200, envelope as Record<string, unknown>)
      } catch (error) {
        sendJson(res, 502, { error: error instanceof Error ? error.message : String(error) })
      }
    })()
  })
}

/** Vite plugin exposing `POST /dsh-web/sessions` for the Session demo sample. */
export function dshWebProxy(): Plugin {
  return {
    name: 'dsh-web-proxy',
    configureServer: registerMiddleware,
  }
}

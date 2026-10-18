/**
 * Wire helpers for the /api/git-sidebar JSON API: bounded body reading, response
 * writing, and the shared error envelope. Every API method returns
 * `{ok: true, value}` on success and `{ok: false, error: {code, message}}`
 * (HTTP 4xx/5xx matching the code) on failure.
 */

/** Machine-readable error codes of the sidebar API. */
export type SidebarErrorCode =
  | 'bad-request'
  | 'not-found'
  | 'forbidden'
  | 'method-error'
  | 'fs-error'
  | 'git-error'
  | 'internal'

/** One API failure with its wire code and HTTP status. */
export class SidebarError extends Error {
  constructor(
    readonly code: SidebarErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20

/** Success envelope of one API method. */
export interface SidebarOk<T> { ok: true; value: T }

/** Failure envelope of one API method. */
export interface SidebarErr { ok: false; error: { code: SidebarErrorCode; message: string } }

/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (request.body === null) return {}
  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BODY_BYTES) {
        // Connection closes unread requests after writing the error response.
        throw new SidebarError('bad-request', 'request body too large')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new SidebarError('bad-request', 'request body is not valid JSON')
  }
}

/** Build the success envelope. */
export function okResponse(value: unknown): Response {
  return Response.json({ ok: true, value })
}

/** Build the failure envelope for any thrown value (unknown → internal 500). */
export function errorResponse(error: unknown): Response {
  if (error instanceof SidebarError) {
    return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
  }
  const message = error instanceof Error ? error.message : String(error)
  return Response.json({ ok: false, error: { code: 'internal', message } }, { status: 500 })
}

/** Narrow an unknown payload value to a string, else throw bad-request. */
export function requireString(payload: unknown, key: string): string {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (typeof value !== 'string' || value === '') {
    throw new SidebarError('bad-request', `missing or invalid "${key}"`)
  }
  return value
}

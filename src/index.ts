/** Independent Git operations for the DSH right sidebar. */
import { open, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import Schema from 'schemastery'
import type { Context } from './context-types.ts'
import * as git from './git.ts'
import { isTrustedApiRequest } from './trust-fence.ts'
import { readJsonBody, requireString, SidebarError, writeError, writeJson, writeOk } from './wire.ts'
export const name = 'dsh-git-sidebar'
export const inject = ['webServer', 'sessions', 'webRuntime']
export const Config = Schema.object({ readLimit: Schema.number().min(1).default(2 * 1024 * 1024) })
function requireAbsolute(path: string): string {
  if (!isAbsolute(path)) throw new SidebarError('bad-request', 'expected an absolute path')
  return resolve(path)
}
/** Narrow a stash ref to the `stash@{n}` shape git itself prints — the ref
 *  reaches the host over the wire, and an arbitrary string would let a caller
 *  smuggle an option (`--all`) into the git argv. */
function requireStashRef(payload: unknown): string {
  const ref = requireString(payload, 'ref')
  if (!/^stash@\{\d+\}$/.test(ref)) throw new SidebarError('bad-request', 'invalid stash ref')
  return ref
}

/** Reject exactly what `git check-ref-format` rejects for a tag name. The name
 *  reaches the host over the wire, so a leading `-` would otherwise be parsed
 *  as a git option; the rest keeps the failure at the wire edge instead of as
 *  an opaque git error. */
export function requireTagName(payload: unknown): string {
  const name = requireString(payload, 'name')
  const invalid = /^[-./]/.test(name)
    || /[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)
    || name.includes('..')
    || name.includes('@{')
    || name.includes('//')
    || /(\/|\.|\.lock)$/.test(name)
  if (invalid) throw new SidebarError('bad-request', 'invalid tag name')
  return name
}

/** The full 40-char hash the history rows carry; anything else is a caller bug. */
function requireCommitHash(payload: unknown, field: string): string {
  const hash = requireString(payload, field)
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(hash)) throw new SidebarError('bad-request', 'invalid commit hash')
  return hash
}

/** Revisions are argv operands, never command-line options. */
function requireRevision(payload: unknown, key: string): string {
  const value = requireString(payload, key)
  if (value.startsWith('-') || value.includes('\0')) throw new SidebarError('bad-request', 'invalid revision')
  return value
}

function requireGitOperation(payload: unknown): git.GitOperation {
  const operation = requireString(payload, 'operation')
  if (operation !== 'merge' && operation !== 'rebase') throw new SidebarError('bad-request', 'invalid git operation')
  return operation
}

/**
 * Resolve a session's authoritative working directory. The attached session
 * header wins; while the session is still hydrating from persistence (the
 * web client attaches the current conversation a moment after page load, so
 * the very first sidebar requests can arrive detached) the caller's own
 * list-summary cwd is used; the process cwd is the last resort (blank
 * sessions have no cwd anywhere yet). Never throws for a missing cwd, so
 * explorer/git/terminal work from first paint instead of surfacing
 * "session ... has no working directory".
 */
function sessionCwdOf(ctx: Context, sessionId: string, clientCwd?: string): string {
  const session = ctx.sessions.get(sessionId)
  const headerCwd = session?.header.cwd
  if (headerCwd !== undefined && headerCwd !== '') return headerCwd
  if (clientCwd !== undefined && clientCwd !== '') {
    try {
      return requireAbsolute(clientCwd)
    } catch {
      throw new SidebarError('bad-request', `invalid working directory "${clientCwd}"`)
    }
  }
  return process.cwd()
}

/**
 * Resolve a path that a git command reported — `git status`/`git diff`
 * print paths RELATIVE TO THE REPO TOP LEVEL, which may sit above the
 * session cwd (a session inside a subdirectory of a repository). Absolute
 * paths pass through; relative ones join the repo root (falling back to the
 * cwd when the root cannot be resolved, e.g. a bare directory).
 */
async function resolveGitPath(cwd: string, raw: string): Promise<string> {
  if (isAbsolute(raw)) return requireAbsolute(raw)
  const root = await git.repoRoot(cwd).catch(() => cwd)
  return requireAbsolute(join(root, raw))
}

const READ_HEAD_LIMIT = 4096

/** Text read of a file with the size cap; binary detection via NUL probe.
 *  Binary reads also return the first {@link READ_HEAD_LIMIT} bytes (base64)
 *  so the client can re-match viewers by content (`detect`). */
async function readText(path: string, readLimit: number): Promise<{
  content: string
  truncated: boolean
  binary: boolean
  size: number
  head?: string
}> {
  const info = await stat(path).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  if (info.isDirectory()) {
    throw new SidebarError('fs-error', `"${path}" is a directory`, 400)
  }
  const size = info.size
  const truncated = size > readLimit
  const handle = await open(path, 'r').catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  try {
    const buffer = Buffer.alloc(Math.min(size, readLimit))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const slice = buffer.subarray(0, bytesRead)
    const binary = slice.includes(0)
    const head = binary
      ? slice.subarray(0, Math.min(slice.length, READ_HEAD_LIMIT)).toString('base64')
      : undefined
    return { content: binary ? '' : slice.toString('utf8'), truncated, binary, size, head }
  } finally {
    await handle.close()
  }
}

export function buildApi(ctx: Context, readLimit: number): Record<string, (payload: unknown) => Promise<unknown>> {
  const cwdOf = (payload: unknown) => {
    const sessionId = requireString(payload, 'sessionId')
    const record = payload as { cwd?: unknown }
    return { sessionId, cwd: sessionCwdOf(ctx, sessionId, typeof record.cwd === 'string' ? record.cwd : undefined) }
  }
  return {
    'fs.read': async (payload) => {
      const { cwd } = cwdOf(payload)
      const path = await resolveGitPath(cwd, requireString(payload, 'path'))
      const result = await readText(path, readLimit)
      return { ...result, kind: result.binary ? 'binary' : 'text' }
    },
    'git.path': async (payload) => ({ path: await resolveGitPath(cwdOf(payload).cwd, requireString(payload, 'path')) }),
    'git.status': async (payload) => {
      const { cwd } = cwdOf(payload)
      return git.status(cwd)
    },
    'git.diff': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { path?: unknown; staged?: unknown }
      const path = record.path === undefined ? undefined : await resolveGitPath(cwd, requireString(payload, 'path'))
      return { diff: await git.diff(cwd, path, record.staged === true) }
    },
    'git.stage': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { path?: unknown }
      const path = record.path === undefined ? undefined : await resolveGitPath(cwd, requireString(payload, 'path'))
      await git.stage(cwd, path)
      return { ok: true }
    },
    'git.unstage': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { path?: unknown }
      const path = record.path === undefined ? undefined : await resolveGitPath(cwd, requireString(payload, 'path'))
      await git.unstage(cwd, path)
      return { ok: true }
    },
    'git.stash': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.stash(cwd)
      return { ok: true }
    },
    'git.stash-list': async (payload) => {
      const { cwd } = cwdOf(payload)
      return { entries: await git.stashList(cwd) }
    },
    'git.stash-pop': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.stashPop(cwd, requireStashRef(payload))
      return { ok: true }
    },
    'git.stash-apply': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.stashApply(cwd, requireStashRef(payload))
      return { ok: true }
    },
    'git.stash-drop': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.stashDrop(cwd, requireStashRef(payload))
      return { ok: true }
    },
    'git.tag-list': async (payload) => {
      const { cwd } = cwdOf(payload)
      return { entries: await git.tags(cwd) }
    },
    'git.tag-create': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { message?: unknown; commit?: unknown }
      await git.createTag(
        cwd,
        requireTagName(payload),
        record.message === undefined ? undefined : requireString(payload, 'message'),
        record.commit === undefined ? undefined : requireCommitHash(payload, 'commit'),
      )
      return { ok: true }
    },
    'git.tag-delete': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.deleteTag(cwd, requireTagName(payload))
      return { ok: true }
    },
    'git.tag-push': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.pushTag(cwd, requireTagName(payload))
      return { ok: true }
    },
    'git.commit': async (payload) => {
      const { cwd } = cwdOf(payload)
      const message = requireString(payload, 'message')
      await git.commit(cwd, message)
      return { ok: true }
    },
    'git.wip-commit': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.wipCommit(cwd)
      return { ok: true }
    },
    'git.reset-to-upstream': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.resetToUpstream(cwd)
      return { ok: true }
    },
    'git.wip-undo': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.wipUndo(cwd)
      return { ok: true }
    },
    'git.fetch': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.fetchRemote(cwd)
      return { ok: true }
    },
    'git.fetch-all': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.fetchRemote(cwd, true)
      return { ok: true }
    },
    'git.push': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.push(cwd)
      return { ok: true }
    },
    'git.branch': async (payload) => {
      const { cwd } = cwdOf(payload)
      return git.branches(cwd)
    },
    'git.checkout': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.checkout(cwd, requireRevision(payload, 'branch'))
      return { ok: true }
    },
    'git.branch-create': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.branchCreate(cwd, requireRevision(payload, 'name'), requireCommitHash(payload, 'commit'))
      return { ok: true }
    },
    'git.branch-delete': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.branchDelete(cwd, requireRevision(payload, 'name'))
      return { ok: true }
    },
    'git.range-diff': async (payload) => {
      const { cwd } = cwdOf(payload)
      const mergeBase = (payload as { mergeBase?: unknown }).mergeBase === true
      return { diff: await git.rangeDiff(cwd, requireRevision(payload, 'from'), requireRevision(payload, 'to'), mergeBase) }
    },
    'git.merge': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.merge(cwd, requireRevision(payload, 'branch'))
      return { ok: true }
    },
    'git.rebase': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.rebase(cwd, requireRevision(payload, 'branch'))
      return { ok: true }
    },
    'git.worktree-list': async (payload) => {
      const { cwd } = cwdOf(payload)
      const [entries, pathPrefix] = await Promise.all([git.worktrees(cwd), git.worktreePathPrefix(cwd)])
      return { entries, pathPrefix }
    },
    'git.worktree-add': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { base?: unknown }
      await git.addWorktree(cwd, requireString(payload, 'path'), requireRevision(payload, 'branch'), record.base === undefined ? undefined : requireRevision(payload, 'base'))
      return { ok: true }
    },
    'git.worktree-merge': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.mergeWorktree(cwd, requireString(payload, 'targetPath'), requireRevision(payload, 'sourceBranch'))
      return { ok: true }
    },
    'git.worktree-remove': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.removeWorktree(cwd, requireString(payload, 'path'))
      return { ok: true }
    },
    'git.operation': async (payload) => {
      const { cwd } = cwdOf(payload)
      return { operation: await git.operation(cwd) }
    },
    'git.operation-continue': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.continueOperation(cwd, requireGitOperation(payload))
      return { ok: true }
    },
    'git.operation-abort': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.abortOperation(cwd, requireGitOperation(payload))
      return { ok: true }
    },
    'git.log': async (payload) => {
      const { cwd } = cwdOf(payload)
      const record = payload as { count?: unknown; skip?: unknown }
      const count = typeof record.count === 'number' && Number.isInteger(record.count) && record.count > 0
        ? record.count
        : undefined
      const skip = typeof record.skip === 'number' && Number.isInteger(record.skip) && record.skip >= 0
        ? record.skip
        : undefined
      return git.log(cwd, count, skip)
    },
    'git.commit-diff': async (payload) => {
      const { cwd } = cwdOf(payload)
      return { diff: await git.commitDiff(cwd, requireCommitHash(payload, 'hash')) }
    },
    'git.discard': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.discard(cwd, await resolveGitPath(cwd, requireString(payload, 'path')))
      return { ok: true }
    },
    'git.discard-all': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.discardAll(cwd)
      return { ok: true }
    },
    'git.revert': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.revert(cwd, requireCommitHash(payload, 'hash'))
      return { ok: true }
    },
    'git.cherry-pick': async (payload) => {
      const { cwd } = cwdOf(payload)
      await git.cherryPick(cwd, requireCommitHash(payload, 'hash'))
      return { ok: true }
    },
    'git.show': async (payload) => {
      const { cwd } = cwdOf(payload)
      const path = await resolveGitPath(cwd, requireString(payload, 'path'))
      const rev = requireRevision(payload, 'rev')
      return { content: await git.show(cwd, rev, path) }
    },
  }
}

export function apply(ctx: Context, config: { readLimit: number }): void {
  const fence = (req: Parameters<typeof isTrustedApiRequest>[0]) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)
  const api = buildApi(ctx, config.readLimit)
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/git-sidebar/api',
    handler: async (req, res) => {
      if (!fence(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/git-sidebar/api/') ? pathname.slice('/git-sidebar/api/'.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new SidebarError('not-found', 'unknown sidebar API method', 404))
        return
      }
      try {
        const payload = await readJsonBody(req)
        const handler = Object.hasOwn(api, method) ? api[method] : undefined
        if (handler === undefined) {
          throw new SidebarError('not-found', `unknown sidebar API method "${method}"`, 404)
        }
        writeOk(res, await handler(payload))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-git-sidebar: /git-sidebar/api routes')

}

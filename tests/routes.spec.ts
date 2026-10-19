import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { mkdtemp, mkdir, realpath, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection'
import { api as clientApi } from '../src/client/api.ts'
import { apply, inject } from '../src/index.ts'
import type { Context } from '../src/context-types.ts'

let root: string
let url: string
const host = new CordisContext()
let connection: HostConnectionService
let disposeConnection: () => Promise<void>
let hostContext: Context
const directoryBySession = new WeakMap<object, string>()
const sessions = new Map<string, { header: { cwd: string } }>()
let directoryAvailable = true
const directory = {
  get: (session: { header: { cwd: string } }) => directoryBySession.get(session) ?? session.header.cwd,
  set: vi.fn(async (agent: { session: object }, path: string) => {
    directoryBySession.set(agent.session, path)
    return path
  }),
}
const server = createServer(async (req, res) => {
  // The Web fallback answers 405 outside the shared /api channel.
  if (!req.url?.startsWith('/api/')) { res.writeHead(405).end(); return }
  const admission = connection.admit(req)
  if ('rejection' in admission) { res.writeHead(admission.rejection).end(); return }
  const response = await connection.createSharedFetchHandler('/api').fetch(new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method!, headers: { 'content-type': 'application/json', cookie: 'test-owner=1' },
    ...(req.method === 'POST' ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' } : {}),
  }))
  const unread = !req.readableEnded
  res.writeHead(response.status, { ...Object.fromEntries(response.headers), ...(unread ? { connection: 'close' } : {}) })
  res.end(Buffer.from(await response.arrayBuffer()))
  if (unread) req.destroy()
})
const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
async function call(method: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(`${url}/api/git-sidebar/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'test-owner=1' },
    body: JSON.stringify({ sessionId: 'test', ...payload }),
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-git-routes-')))
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid')
  await mkdir(join(root, 'sub'))
  await writeFile(join(root, 'file.txt'), 'base\n')
  git('add', '.'); git('commit', '-m', 'base')
  const fiber = host.plugin((ctx) => {
    connection = new HostConnectionService(ctx, [], {
      isAuthenticated: (request: { headers: { cookie?: string } }) => request.headers.cookie === 'test-owner=1',
      authenticateApi: () => undefined,
    } as unknown as ConstructorParameters<typeof HostConnectionService>[2])
  })
  await fiber.await()
  disposeConnection = () => fiber.dispose()
  sessions.set('test', { header: { cwd: join(root, 'sub') } })
  sessions.set('fresh', { header: { cwd: join(root, 'sub') } })
  const ctx = {
    sessions: { get: (id: string) => sessions.get(id) },
    agents: { get: (id: string) => {
      const session = sessions.get(id)
      return session === undefined ? undefined : { session, ctx: { get: () => directoryAvailable ? directory : undefined } }
    } },
    workingDirectory: directory,
    sessionController: { resolveAgent: async (id: string) => {
      const session = sessions.get(id)
      return session === undefined ? { error: new Error('session unavailable') }
        : { agent: { session, ctx: { get: () => directoryAvailable ? directory : undefined } } }
    } },
    connection,
  } as unknown as Context
  hostContext = ctx
  apply(ctx, { readLimit: 1024 })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  url = `http://127.0.0.1:${address.port}`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await disposeConnection?.()
  await rm(root, { recursive: true, force: true })
})
it('stages repo-relative paths from a subdirectory and commits without better-sidebar', async () => {
  await writeFile(join(root, 'file.txt'), 'changed\n')
  expect((await call('git.status')).body.value.entries).toContainEqual({ path: 'file.txt', xy: ' M' })
  expect((await call('git.stage', { path: 'file.txt' })).status).toBe(200)
  expect((await call('git.diff', { path: 'file.txt', staged: true })).body.value.diff).toContain('+changed')
  expect((await call('git.commit', { message: 'standalone' })).status).toBe(200)
  expect(git('log', '-1', '--format=%s')).toBe('standalone')
  expect((await call('git.path', { path: 'file.txt' })).body.value.path).toBe(join(root, 'file.txt'))
  expect((await call('fs.read', { path: 'file.txt' })).body.value.content).toBe('changed\n')
})
it('checks a Workspace path even when it has no Session', async () => {
  const linked = await mkdtemp(join(tmpdir(), 'dsh-git-linked-'))
  await rm(linked, { recursive: true })
  git('worktree', 'add', '--detach', linked)
  try {
    expect((await call('git.worktree-linked', { path: linked })).body.value).toEqual({ linked: true, main: await realpath(root) })
    expect((await call('git.worktree-linked', { path: root })).body.value).toEqual({ linked: false })
  } finally {
    git('worktree', 'remove', '--force', linked)
  }
})
it('switches only the current Session to a registered Worktree and uses it for later Git operations', async () => {
  const linked = `${root}-linked`
  git('worktree', 'add', '-b', 'feat/session', linked)
  try {
    expect((await call('git.worktree-open', { path: linked })).body.value).toEqual({ path: linked })
    expect((await call('git.status', { cwd: root })).body.value.branch).toBe('feat/session')
    expect((await call('git.worktree-list')).body.value.entries.find((entry: { current: boolean }) => entry.current).path).toBe(linked)
    await writeFile(join(linked, 'file.txt'), 'worktree only\n')
    expect((await call('git.stage', { path: 'file.txt', cwd: root })).status).toBe(200)
    expect((await call('git.diff', { path: 'file.txt', staged: true })).body.value.diff).toContain('+worktree only')
    expect((await call('git.path', { path: 'file.txt' })).body.value.path).toBe(join(linked, 'file.txt'))
    expect((await call('git.status', { sessionId: 'fresh' })).body.value.branch).toBe('main')
    expect(git('diff', '--cached')).toBe('')
    expect(sessions.get('test')!.header.cwd).toBe(join(root, 'sub'))
    expect((await call('git.worktree-open', { path: tmpdir() })).status).toBe(400)
    expect((await call('git.worktree-open', { path: `${root}-missing` })).body.ok).toBe(false)
    expect((await call('git.status')).body.value.branch).toBe('feat/session')
    directoryAvailable = false
    expect((await call('git.worktree-open', { path: root })).body.error.code).toBe('method-error')
    expect((await call('git.status')).body.value.branch).toBe('feat/session')
    directoryAvailable = true
    expect((await call('git.worktree-open', { path: root })).body.value.path).toBe(root)
    expect((await call('git.status')).body.value.branch).toBe('main')
  } finally {
    directoryAvailable = true
    directoryBySession.delete(sessions.get('test')!)
    git('worktree', 'remove', '--force', linked)
    git('branch', '-d', 'feat/session')
  }
})
it('switches external Harness directories through the Harness service and rejects older unsupported providers', async () => {
  const changeWorkingDirectory = vi.fn(async (_id: string, input: { path: string }) => {
    directoryBySession.set(sessions.get('test')!, input.path)
    return { cwd: input.path }
  })
  const harnesses = vi.fn(async () => ({ test: { harness: 'codex' } }))
  hostContext.harness = { changeWorkingDirectory, harnesses }
  try {
    expect((await call('git.worktree-open', { path: root })).body.value).toEqual({ path: root })
    expect(changeWorkingDirectory).toHaveBeenCalledWith('test', { path: root })
    hostContext.harness = { harnesses }
    const unsupported = await call('git.worktree-open', { path: root })
    expect(unsupported.body.error.code).toBe('method-error')
    expect(unsupported.status).toBe(400)
    harnesses.mockResolvedValue({ test: { harness: 'dsh' } })
    expect((await call('git.worktree-open', { path: root })).body.value.path).toBe(root)
  } finally {
    delete hostContext.harness
    directoryBySession.delete(sessions.get('test')!)
  }
})
it('keeps failures explicit and rejects cross-site requests and option injection', async () => {
  for (const [method, payload] of [
    ['git.checkout', { branch: '--orphan=bad' }], ['git.revert', { hash: '--all' }],
    ['git.stash-drop', { ref: '--all' }], ['git.tag-create', { name: '-bad' }],
    ['git.branch-create', { name: '-D', commit: 'a'.repeat(40) }], ['git.branch-delete', { names: ['--force'] }],
    ['git.branch-delete', { names: ['ok', '--exec=touch /tmp/x'], remote: true }], ['git.branch-delete', { names: [] }],
    ['git.range-diff', { from: '--output=/tmp/x', to: 'HEAD' }],
    ['git.worktree-linked', { path: '--exec=bad' }],
    ['git.worktree-open', { path: '--exec=bad' }],
    ['git.worktree-open', { path: root, sessionId: '' }],
  ] as const) expect((await call(method, payload)).status).toBe(400)
  expect((await call('git.worktree-linked')).status).toBe(400)
  expect((await call('git.branch-list')).body.value.local[0]).toMatchObject({ name: 'main', current: true })
  expect((await call('git.branch-prune')).body.ok).toBe(false)
  expect((await call('git.commit', { message: 'nothing staged' })).body.ok).toBe(false)
  expect((await call('git.wip-undo')).body.ok).toBe(false)
  expect((await call('git.reset-to-upstream')).body.ok).toBe(false)
  expect((await call('git.fast-forward')).body.ok).toBe(false)
  expect(git('log', '-1', '--format=%s')).toBe('standalone')
  expect((await call('toString')).status).toBe(404)
  const response = await fetch(`${url}/api/git-sidebar/git.status`, { method: 'POST', headers: { origin: 'https://example.invalid', cookie: 'test-owner=1' }, body: '{}' })
  expect(response.status).toBe(403)
  expect(await readFile(join(root, 'file.txt'), 'utf8')).toBe('changed\n')
})

it('uses the current Connection services and routes the real client status request without HTTP 405', async () => {
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => realFetch(new URL(input, url), {
    ...init, headers: { ...init.headers, cookie: 'test-owner=1' },
  }))
  try {
    expect(await clientApi.gitStatus({ sessionId: 'test' })).toMatchObject({ isRepo: true, branch: 'main' })
    expect(await clientApi.gitBranch({ sessionId: 'test' })).toMatchObject({ current: 'main', names: ['main'] })
    expect(await clientApi.gitLog({ sessionId: 'test' })).not.toHaveLength(0)
    expect(await clientApi.gitOperation({ sessionId: 'test' })).toEqual({ operation: null })
    expect(await clientApi.gitWorktrees({ sessionId: 'test' })).toHaveProperty('entries')
    expect(await clientApi.gitStashList({ sessionId: 'test' })).toEqual({ entries: [] })
    expect(await clientApi.gitTags({ sessionId: 'test' })).toEqual({ entries: [] })
    expect(inject).toEqual({ sessions: { required: true }, agents: { required: true }, connection: { required: true }, sessionController: { required: true }, workingDirectory: { required: false }, harness: { required: false } })
  } finally { vi.unstubAllGlobals() }
})
it('keeps Connection authentication and bounded JSON parsing', async () => {
  const path = `${url}/api/git-sidebar/git.status`
  expect((await fetch(path, { method: 'POST', body: '{}' })).status).toBe(401)
  expect((await fetch(path, {
    method: 'POST', headers: { cookie: 'test-owner=1' },
    body: JSON.stringify({ sessionId: 'test' }).padEnd(1 << 20, ' '),
  })).status).toBe(200)
  expect((await fetch(path, { method: 'POST', headers: { cookie: 'test-owner=1' }, body: '{' })).status).toBe(400)
  for (const body of ['{', 'x'.repeat((1 << 20) + 1), 'x'.repeat(2 << 20)]) {
    const init = { method: 'POST', body: new Blob([body]).stream(), duplex: 'half' }
    const response = await connection.createSharedFetchHandler('/api').fetch(new Request(path, init))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'bad-request' } })
  }
  expect((await fetch(path, { headers: { cookie: 'test-owner=1' } })).status).toBe(404)
})

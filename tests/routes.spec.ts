import { createServer } from 'node:http'
import { mkdtemp, mkdir, realpath, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import type { Context } from '../src/context-types.ts'

let root: string
let url: string
const server = createServer()
const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
async function call(method: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(`${url}/git-sidebar/api/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'test', ...payload }),
  })
  return { status: response.status, body: await response.json() }
}
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-git-routes-')))
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid')
  await mkdir(join(root, 'sub'))
  await writeFile(join(root, 'file.txt'), 'base\n')
  git('add', '.'); git('commit', '-m', 'base')
  // This test supplies only the host services consumed by apply.
  const ctx = {
    effect: (effect: () => unknown) => effect(),
    sessions: { get: () => ({ header: { cwd: join(root, 'sub') } }) },
    webRuntime: { trustedHosts: [] },
    webServer: { register: (route: { handler: Parameters<typeof server.on>[1] }) => {
      server.on('request', route.handler)
      return () => server.off('request', route.handler)
    } },
  } as unknown as Context
  apply(ctx, { readLimit: 1024 })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  url = `http://127.0.0.1:${address.port}`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
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
it('keeps failures explicit and rejects cross-site requests and option injection', async () => {
  for (const [method, payload] of [
    ['git.checkout', { branch: '--orphan=bad' }], ['git.revert', { hash: '--all' }],
    ['git.stash-drop', { ref: '--all' }], ['git.tag-create', { name: '-bad' }],
    ['git.branch-create', { name: '-D', commit: 'a'.repeat(40) }], ['git.branch-delete', { names: ['--force'] }],
    ['git.branch-delete', { names: ['ok', '--exec=touch /tmp/x'], remote: true }], ['git.branch-delete', { names: [] }],
    ['git.range-diff', { from: '--output=/tmp/x', to: 'HEAD' }],
  ] as const) expect((await call(method, payload)).status).toBe(400)
  expect((await call('git.branch-list')).body.value.local[0]).toMatchObject({ name: 'main', current: true })
  expect((await call('git.branch-prune')).body.ok).toBe(false)
  expect((await call('git.commit', { message: 'nothing staged' })).body.ok).toBe(false)
  expect((await call('git.wip-undo')).body.ok).toBe(false)
  expect((await call('git.reset-to-upstream')).body.ok).toBe(false)
  expect((await call('git.fast-forward')).body.ok).toBe(false)
  expect(git('log', '-1', '--format=%s')).toBe('standalone')
  expect((await call('toString')).status).toBe(404)
  const response = await fetch(`${url}/git-sidebar/api/git.status`, { method: 'POST', headers: { origin: 'https://example.invalid' }, body: '{}' })
  expect(response.status).toBe(403)
  expect(await readFile(join(root, 'file.txt'), 'utf8')).toBe('changed\n')
})

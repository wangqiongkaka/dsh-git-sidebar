/** Stable, session-scoped addresses keep separate file/commit diffs in separate tabs. */
import type { SidebarDiffRef } from './state.ts'
const PREFIX = 'dsh-resource://git-diff/'

export function diffAddress(sessionId: string, diff: SidebarDiffRef): string {
  return `${PREFIX}${encodeURIComponent(sessionId)}/${encodeURIComponent(JSON.stringify(diff))}`
}

/** Validate addresses restored from the sidebar or supplied by another plugin. */
export function parseDiffAddress(address: string): { sessionId: string; diff: SidebarDiffRef } | undefined {
  if (!address.startsWith(PREFIX)) return undefined
  try {
    const parts = address.slice(PREFIX.length).split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined
    const sessionId = decodeURIComponent(parts[0])
    const value: unknown = JSON.parse(decodeURIComponent(parts[1]))
    if (value === null || typeof value !== 'object') return undefined
    const diff = value as Record<string, unknown>
    if (diff.kind === 'worktree' && typeof diff.path === 'string' && diff.path !== '' && typeof diff.staged === 'boolean'
      && (diff.untracked === undefined || typeof diff.untracked === 'boolean')) {
      return { sessionId, diff: { kind: 'worktree', path: diff.path, staged: diff.staged, untracked: diff.untracked } }
    }
    if (diff.kind === 'commit' && typeof diff.hashFull === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(diff.hashFull)
      && typeof diff.hash === 'string' && typeof diff.subject === 'string') {
      return { sessionId, diff: { kind: 'commit', hash: diff.hash, hashFull: diff.hashFull, subject: diff.subject } }
    }
    if (diff.kind === 'range' && typeof diff.from === 'string' && diff.from !== '' && typeof diff.to === 'string' && diff.to !== ''
      && typeof diff.mergeBase === 'boolean' && typeof diff.title === 'string') {
      return { sessionId, diff: { kind: 'range', from: diff.from, to: diff.to, mergeBase: diff.mergeBase, title: diff.title } }
    }
    return undefined
  } catch { return undefined /* A malformed URI/JSON is not a Git diff address. */ }
}

export function diffTitle(diff: SidebarDiffRef): string {
  if (diff.kind === 'commit') return `${diff.hash} ${diff.subject}`
  if (diff.kind === 'range') return diff.title
  return diff.path.split(/[\\/]/).at(-1)!
}

/** Session-scoped Git API client. */
/** One wire failure. */
export class SidebarApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Git status entry (host git shape). */
export interface GitStatusEntry {
  path: string
  xy: string
}

/** Git status snapshot. */
export interface GitStatusResult {
  isRepo: boolean
  branch?: string
  ahead: number
  behind: number
  entries: GitStatusEntry[]
}

/** One stash stack row (host git shape). */
export interface GitStashEntry {
  /** Stack ref, e.g. 'stash@{0}'. */
  ref: string
  /** Subject line, e.g. 'WIP on main: 1a2b3c4 subject'. */
  message: string
}

/** One tag row (host git shape). */
export interface GitTagEntry {
  /** Tag name, e.g. 'v1.2.0'. */
  name: string
  /** Annotation subject for an annotated tag; the tagged commit's subject for a lightweight one. */
  subject: string
}

/** One git log row. */
export interface GitLogEntry {
  /** Short hash (7+ chars, display). */
  hash: string
  /** Full 40-char hash (advanced operations). */
  hashFull: string
  subject: string
  author: string
  /** ISO 8601 author date (`%ai`). */
  date: string
  /** Ref decorations (--decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
  refs: string
  /** Full parent hashes, first parent first; [] for a root commit. */
  parents: string[]
}

export interface GitWorktree {
  path: string
  head: string
  branch?: string
  current: boolean
  locked: boolean
  prunable: boolean
}
export type GitOperation = 'merge' | 'rebase'

/** Text read result. */
export interface FsTextResult { kind: 'text'; content: string; truncated: boolean }
/** Binary read result (no content; images load through the media route).
 *  `head` carries the first bytes (base64) for viewer detect sniffing. */
export interface FsBinaryResult { kind: 'binary'; size: number; truncated: boolean; head: string }

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/git-sidebar/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new SidebarApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new SidebarApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value as T
}

/** One request's session scope: the conversation id plus its cwd when known. */
export interface SessionScope {
  sessionId: string
  /** The session's working directory from the client list summary (optional). */
  cwd?: string
}

/** Fold a scope into a JSON payload ({cwd} only when present). */
function scopePayload(scope: SessionScope, extra: Record<string, unknown>): Record<string, unknown> {
  return { sessionId: scope.sessionId, ...(scope.cwd !== undefined && scope.cwd !== '' ? { cwd: scope.cwd } : {}), ...extra }
}

export const api = {
  gitPath: (scope: SessionScope, path: string) => call<{ path: string }>('git.path', scopePayload(scope, { path })),
  fsRead: (scope: SessionScope, path: string, signal?: AbortSignal) =>
    call<FsTextResult | FsBinaryResult>('fs.read', scopePayload(scope, { path }), signal),
  gitStatus: (scope: SessionScope, signal?: AbortSignal) =>
    call<GitStatusResult>('git.status', scopePayload(scope, {}), signal),
  gitDiff: (scope: SessionScope, path: string | undefined, staged: boolean, signal?: AbortSignal) =>
    call<{ diff: string }>('git.diff', scopePayload(scope, { ...(path !== undefined ? { path } : {}), staged }), signal),
  gitStage: (scope: SessionScope, path?: string) =>
    call<{ ok: true }>('git.stage', scopePayload(scope, { ...(path !== undefined ? { path } : {}) })),
  gitUnstage: (scope: SessionScope, path?: string) =>
    call<{ ok: true }>('git.unstage', scopePayload(scope, { ...(path !== undefined ? { path } : {}) })),
  gitStash: (scope: SessionScope) =>
    call<{ ok: true }>('git.stash', scopePayload(scope, {})),
  gitStashList: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ entries: GitStashEntry[] }>('git.stash-list', scopePayload(scope, {}), signal),
  gitStashPop: (scope: SessionScope, ref: string) =>
    call<{ ok: true }>('git.stash-pop', scopePayload(scope, { ref })),
  gitStashApply: (scope: SessionScope, ref: string) =>
    call<{ ok: true }>('git.stash-apply', scopePayload(scope, { ref })),
  gitStashDrop: (scope: SessionScope, ref: string) =>
    call<{ ok: true }>('git.stash-drop', scopePayload(scope, { ref })),
  gitTags: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ entries: GitTagEntry[] }>('git.tag-list', scopePayload(scope, {}), signal),
  /** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
  gitTagCreate: (scope: SessionScope, name: string, message?: string, commit?: string) =>
    call<{ ok: true }>('git.tag-create', scopePayload(scope, {
      name,
      ...(message === undefined || message === '' ? {} : { message }),
      ...(commit === undefined ? {} : { commit }),
    })),
  gitTagDelete: (scope: SessionScope, name: string) =>
    call<{ ok: true }>('git.tag-delete', scopePayload(scope, { name })),
  gitTagPush: (scope: SessionScope, name: string) =>
    call<{ ok: true }>('git.tag-push', scopePayload(scope, { name })),
  gitCommit: (scope: SessionScope, message: string) =>
    call<{ ok: true }>('git.commit', scopePayload(scope, { message })),
  /** Stage everything and commit it as a "WIP" commit. */
  gitWipCommit: (scope: SessionScope) =>
    call<{ ok: true }>('git.wip-commit', scopePayload(scope, {})),
  /** Reset the WIP commit at HEAD back into the working tree (rejected when HEAD is not a WIP commit). */
  gitWipUndo: (scope: SessionScope) =>
    call<{ ok: true }>('git.wip-undo', scopePayload(scope, {})),
  gitFetch: (scope: SessionScope, all = false) =>
    call<{ ok: true }>(all ? 'git.fetch-all' : 'git.fetch', scopePayload(scope, {})),
  gitPush: (scope: SessionScope) =>
    call<{ ok: true }>('git.push', scopePayload(scope, {})),
  gitBranch: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ current: string; names: string[] }>('git.branch', scopePayload(scope, {}), signal),
  gitCheckout: (scope: SessionScope, branch: string) =>
    call<{ ok: true }>('git.checkout', scopePayload(scope, { branch })),
  /** Create a branch at a commit (no switch). */
  gitBranchCreate: (scope: SessionScope, name: string, commit: string) =>
    call<{ ok: true }>('git.branch-create', scopePayload(scope, { name, commit })),
  /** Delete a merged local branch. */
  gitBranchDelete: (scope: SessionScope, name: string) =>
    call<{ ok: true }>('git.branch-delete', scopePayload(scope, { name })),
  /** Patch between two revisions (left side = merge-base when `mergeBase`). */
  gitRangeDiff: (scope: SessionScope, from: string, to: string, mergeBase: boolean, signal?: AbortSignal) =>
    call<{ diff: string }>('git.range-diff', scopePayload(scope, { from, to, mergeBase }), signal),
  gitMerge: (scope: SessionScope, branch: string) =>
    call<{ ok: true }>('git.merge', scopePayload(scope, { branch })),
  gitRebase: (scope: SessionScope, branch: string) =>
    call<{ ok: true }>('git.rebase', scopePayload(scope, { branch })),
  gitWorktrees: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ entries: GitWorktree[]; pathPrefix: string }>('git.worktree-list', scopePayload(scope, {}), signal),
  gitWorktreeAdd: (scope: SessionScope, path: string, branch: string, base?: string) =>
    call<{ ok: true }>('git.worktree-add', scopePayload(scope, { path, branch, ...(base === undefined ? {} : { base }) })),
  gitWorktreeMerge: (scope: SessionScope, targetPath: string, sourceBranch: string) =>
    call<{ ok: true }>('git.worktree-merge', scopePayload(scope, { targetPath, sourceBranch })),
  gitWorktreeRemove: (scope: SessionScope, path: string) =>
    call<{ ok: true }>('git.worktree-remove', scopePayload(scope, { path })),
  gitOperation: (scope: SessionScope, signal?: AbortSignal) =>
    call<{ operation: GitOperation | null }>('git.operation', scopePayload(scope, {}), signal),
  gitOperationContinue: (scope: SessionScope, operation: GitOperation) =>
    call<{ ok: true }>('git.operation-continue', scopePayload(scope, { operation })),
  gitOperationAbort: (scope: SessionScope, operation: GitOperation) =>
    call<{ ok: true }>('git.operation-abort', scopePayload(scope, { operation })),
  /** Recent commit history, lazily pageable (skip/count; defaults 0/30). */
  gitLog: (scope: SessionScope, count?: number, skip?: number, signal?: AbortSignal) =>
    call<GitLogEntry[]>('git.log', scopePayload(scope, {
      ...(count !== undefined ? { count } : {}),
      ...(skip !== undefined ? { skip } : {}),
    }), signal),
  /** Full patch text of one commit (diff display for the history rows). */
  gitCommitDiff: (scope: SessionScope, hash: string, signal?: AbortSignal) =>
    call<{ diff: string }>('git.commit-diff', scopePayload(scope, { hash }), signal),
  /** Discard the worktree changes of one file (the index is untouched). */
  gitDiscard: (scope: SessionScope, path: string) =>
    call<{ ok: true }>('git.discard', scopePayload(scope, { path })),
  /** Restore all tracked files to HEAD and unstage additions without deleting them. */
  gitDiscardAll: (scope: SessionScope) =>
    call<{ ok: true }>('git.discard-all', scopePayload(scope, {})),
  /** Revert one commit onto the current branch. */
  gitRevert: (scope: SessionScope, hash: string) =>
    call<{ ok: true }>('git.revert', scopePayload(scope, { hash })),
  /** Cherry-pick one commit onto the current branch. */
  gitCherryPick: (scope: SessionScope, hash: string) =>
    call<{ ok: true }>('git.cherry-pick', scopePayload(scope, { hash })),
}

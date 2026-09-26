/**
 * Git operations for the sidebar source-control panel. Everything goes
 * through the system `git` binary spawned per request (no library, no state),
 * with porcelain-parseable output formats (`-z` NUL framing, unit separators)
 * so parsing never depends on locale or color config. All commands run with
 * `-C <cwd>` on the session's working directory and `--no-pager` /
 * `-c color.ui=false` so output stays machine-readable.
 *
 * Commits use the user's git global identity untouched (never sets
 * user.name/user.email).
 */
import { spawn } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'

export type GitOperation = 'merge' | 'rebase'

/** Subject of a throwaway WIP commit; `wipUndo` only resets a HEAD with exactly this subject. */
export const WIP_SUBJECT = 'WIP'

/** A parsed `git status --porcelain=v1 -z` entry. */
export interface GitStatusEntry {
  path: string
  /** Two-letter index/worktree status (X Y), e.g. 'M ', ' M', 'A ', '??'. */
  xy: string
}

/** The source-control panel snapshot. */
export interface GitStatusResult {
  isRepo: boolean
  branch?: string
  ahead: number
  behind: number
  entries: GitStatusEntry[]
}

/** One `git log` row. */
export interface GitLogEntry {
  /** Short hash (7+ chars, display). */
  hash: string
  /** Full 40-char hash (advanced operations: revert / cherry-pick). */
  hashFull: string
  subject: string
  author: string
  /** ISO 8601 author date (`%ai`), e.g. `2024-01-01 10:00:00 +0800`. */
  date: string
  /** Ref decorations (`%D` with --decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
  refs: string
  /** Full parent hashes (`%P`), first parent first; [] for a root commit. */
  parents: string[]
}

/** One linked checkout from `git worktree list --porcelain -z`. */
export interface GitWorktree {
  path: string
  head: string
  branch?: string
  current: boolean
  locked: boolean
  prunable: boolean
}

/** One `git stash list` row. */
export interface GitStashEntry {
  /** Stack ref, e.g. 'stash@{0}'. */
  ref: string
  /** Subject line, e.g. 'WIP on main: 1a2b3c4 subject'. */
  message: string
}

/** One branch row of the branch manager (local, or remote as `origin/name`). */
export interface GitBranchEntry {
  name: string
  current: boolean
  /** Reachable from HEAD, i.e. safe to delete. */
  merged: boolean
  /** Configured upstream (`origin/main`); absent when the branch tracks nothing. */
  upstream?: string
  /** Upstream configured but deleted on the remote (`[gone]`). */
  gone: boolean
  ahead: number
  behind: number
  /** Last commit date (`%(committerdate:short)`, e.g. 2024-01-01). */
  date: string
  subject: string
}

/** One failed branch deletion inside a batch. */
export interface GitBranchFailure {
  name: string
  message: string
}

/** Branch manager snapshot. */
export interface GitBranchOverview {
  current: string
  /** Preferred remote name; absent when the repository has no remote. */
  remote?: string
  local: GitBranchEntry[]
  remotes: GitBranchEntry[]
}

export interface GitTagEntry {
  /** Tag name, e.g. 'v1.2.0'. */
  name: string
  /** Annotation subject for an annotated tag; the tagged commit's subject for a lightweight one. */
  subject: string
  /** Whether this exact tag object exists on the preferred remote. */
  remoteState: 'synced' | 'local' | 'unknown'
}

// ponytail: process-local TTL cache; cap it if one host starts opening thousands of workspaces.
const remoteTagCache = new Map<string, { expires: number; refs: Map<string, string> | null }>()

/** One git failure (stderr text as the message). */
export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly code = 'git-error',
    readonly command: string,
  ) {
    super(message)
  }
}

/** Parse porcelain v1 -z output into entries (rename/copy pairs collapse to one row). */
export function parsePorcelainZ(output: string): GitStatusEntry[] {
  const tokens = output.split('\0')
  const entries: GitStatusEntry[] = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]!
    index += 1
    if (token === '') continue
    const xy = token.slice(0, 2)
    const rest = token.slice(3)
    entries.push({ path: rest, xy })
    // Rename/copy entries carry the ORIGIN path as the next NUL field; the
    // new path (the file as it exists now) is the display path.
    if ((xy[0] === 'R' || xy[0] === 'C') && tokens[index] !== undefined && tokens[index] !== '') {
      index += 1
    }
  }
  return entries
}

/** Parse `git log --pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D%x1f%P` rows. */
export function parseLogLines(output: string): GitLogEntry[] {
  const rows: GitLogEntry[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const [hash, subject, author, date, hashFull, refs, parents] = line.split('\x1f')
    if (hash === undefined || subject === undefined) continue
    rows.push({
      hash,
      subject,
      author: author ?? '',
      date: date ?? '',
      hashFull: hashFull ?? hash,
      refs: refs ?? '',
      parents: (parents ?? '').split(' ').filter(part => part !== ''),
    })
  }
  return rows
}

/** Parse NUL-framed worktree porcelain without depending on paths being newline-free. */
export function parseWorktreePorcelainZ(output: string): GitWorktree[] {
  const entries: GitWorktree[] = []
  let entry: GitWorktree | undefined
  for (const field of output.split('\0')) {
    if (field === '') {
      if (entry !== undefined) entries.push(entry)
      entry = undefined
      continue
    }
    const at = field.indexOf(' ')
    const key = at === -1 ? field : field.slice(0, at)
    const value = at === -1 ? '' : field.slice(at + 1)
    if (key === 'worktree') entry = { path: value, head: '', current: false, locked: false, prunable: false }
    else if (entry !== undefined && key === 'HEAD') entry.head = value
    else if (entry !== undefined && key === 'branch') entry.branch = value.replace(/^refs\/heads\//, '')
    else if (entry !== undefined && key === 'locked') entry.locked = true
    else if (entry !== undefined && key === 'prunable') entry.prunable = true
  }
  return entries
}

/** Run one git command; resolves with stdout, rejects with GitCommandError. */
function runGit(cwd: string, args: string[], timeoutMs = 30_000): Promise<string> {
  const full = ['-C', cwd, '--no-pager', '-c', 'color.ui=false', ...args]
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn('git', full, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new GitCommandError(`git ${args[0] ?? ''} timed out after ${timeoutMs}ms`, 'git-error', args.join(' ')))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new GitCommandError(`cannot run git: ${error.message}`, 'git-error', args.join(' ')))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolvePromise(stdout)
      } else {
        reject(new GitCommandError(stderr.trim() || `git exited with ${String(code)}`, 'git-error', args.join(' ')))
      }
    })
  })
}

/** Whether the directory is inside a git work tree (exit-0 `git rev-parse`). */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const out = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
    return out.trim() === 'true'
  } catch {
    return false
  }
}

/** The repository top level containing `cwd` (`git rev-parse --show-toplevel`). */
export async function repoRoot(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  return out.trim()
}

/** The current branch name (`git rev-parse --abbrev-ref HEAD`; 'HEAD' when detached). */
export async function currentBranch(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return out.trim()
}

/** Working-tree status (untracked included). */
export async function status(cwd: string): Promise<GitStatusResult> {
  const repo = await isGitRepo(cwd)
  if (!repo) return { isRepo: false, ahead: 0, behind: 0, entries: [] }
  const [branch, raw, [behind, ahead]] = await Promise.all([
    currentBranch(cwd).catch(() => 'HEAD'),
    runGit(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']),
    // "<behind>\t<ahead>"; no upstream → both 0.
    runGit(cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
      .then((value): [number, number] => {
        const [left = 0, right = 0] = value.trim().split(/\s+/).map(Number)
        return [left, right]
      })
      .catch((): [number, number] => [0, 0]),
  ])
  return { isRepo: true, branch, ahead, behind, entries: parsePorcelainZ(raw) }
}

/** Fetch the current remote, or every configured remote. */
export async function fetchRemote(cwd: string, all = false): Promise<void> {
  await runGit(cwd, ['fetch', ...(all ? ['--all'] : [])], 120_000)
}

/** Push the current branch to its configured upstream. */
export async function push(cwd: string): Promise<void> {
  await runGit(cwd, ['push'], 120_000)
}

/** Diff text of the worktree (unstaged) or the index (staged). */
export async function diff(cwd: string, path: string | undefined, staged: boolean): Promise<string> {
  const args = ['diff', '--no-ext-diff', '--no-color', '-U3']
  if (staged) args.push('--cached')
  if (path !== undefined) args.push('--', path)
  return runGit(cwd, args)
}

/** Stage paths (all when path is undefined). */
export async function stage(cwd: string, path: string | undefined): Promise<void> {
  await runGit(cwd, ['add', '-A', ...(path !== undefined ? ['--', path] : [])])
}

/** Unstage paths (all when path is undefined). */
export async function unstage(cwd: string, path: string | undefined): Promise<void> {
  await runGit(cwd, ['reset', '-q', ...(path !== undefined ? ['--', path] : [])])
}

/**
 * Push every change onto the stash stack. Untracked files are included so the
 * panel's three change groups all clear together — leaving them behind makes
 * the button look like it did nothing.
 */
export async function stash(cwd: string): Promise<void> {
  await runGit(cwd, ['stash', 'push', '--include-untracked'])
}

/** The stash stack, newest (stash@{0}) first; [] when empty. */
export async function stashList(cwd: string): Promise<GitStashEntry[]> {
  const raw = await runGit(cwd, ['stash', 'list', '-z', '--format=%gd%x1f%s'])
  return raw.split('\0').filter(row => row !== '').map((row) => {
    const [ref, message] = row.split('\x1f')
    return { ref: ref ?? '', message: message ?? '' }
  })
}

/** Restore one stash entry and remove it from the stack. */
export async function stashPop(cwd: string, ref: string): Promise<void> {
  await runGit(cwd, ['stash', 'pop', ref])
}

/** Restore one stash entry, keeping it on the stack. */
export async function stashApply(cwd: string, ref: string): Promise<void> {
  await runGit(cwd, ['stash', 'apply', ref])
}

/** Discard one stash entry (not recoverable). */
export async function stashDrop(cwd: string, ref: string): Promise<void> {
  await runGit(cwd, ['stash', 'drop', ref])
}

/** Commit the staged changes with a message (global identity untouched). */
export async function commit(cwd: string, message: string): Promise<void> {
  await runGit(cwd, ['commit', '-m', message])
}

/** Stage everything (untracked included) and commit it as a throwaway "WIP" commit. */
export async function wipCommit(cwd: string): Promise<void> {
  await runGit(cwd, ['add', '-A'])
  await runGit(cwd, ['commit', '-q', '-m', WIP_SUBJECT])
}

/**
 * Drop the WIP commit at HEAD and put its changes back into the working tree
 * (mixed reset, so they show up unstaged like before the WIP commit). Refuses
 * when HEAD is not a WIP commit so a real commit can never be reset by accident.
 */
export async function wipUndo(cwd: string): Promise<void> {
  const subject = (await runGit(cwd, ['log', '-1', '--format=%s'])).trim()
  if (subject !== WIP_SUBJECT) throw new GitCommandError('HEAD is not a WIP commit', 'git-error', 'wip-undo')
  // A WIP commit that already reached the upstream must not be reset away: the
  // panel has no force-push, so the branches would diverge with no way back.
  const pushed = await runGit(cwd, ['merge-base', '--is-ancestor', 'HEAD', '@{upstream}']).then(() => true, () => false)
  if (pushed) throw new GitCommandError('WIP commit was already pushed; undo it from a terminal', 'git-error', 'wip-undo')
  await runGit(cwd, ['reset', '-q', 'HEAD~1'])
}

/**
 * Move the branch back to its upstream (`git reset @{upstream}`, mixed): every
 * unpushed commit is unwound into the working tree, no file content is lost.
 * Refuses when the branch is behind so that fetched remote commits can never be
 * pulled in through a reset. Needs a configured upstream.
 */
export async function resetToUpstream(cwd: string): Promise<void> {
  const counts = await runGit(cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  const [behind = 0, ahead = 0] = counts.trim().split(/\s+/).map(Number)
  if (behind > 0) throw new GitCommandError('branch is behind its upstream; fetch and merge first', 'git-error', 'reset-to-upstream')
  if (ahead === 0) return
  await runGit(cwd, ['reset', '-q', '@{upstream}'])
}

/** Local branch names by latest commit time (newest first). */
export async function branches(cwd: string): Promise<{ current: string; names: string[] }> {
  const [current, raw] = await Promise.all([
    currentBranch(cwd).catch(() => 'HEAD'),
    runGit(cwd, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:strip=2)', 'refs/heads']),
  ])
  const names = raw.split('\n').filter(line => line !== '')
  return { current, names: names.includes(current) ? names : [current, ...names] }
}

/** Switch to an existing branch. */
export async function checkout(cwd: string, branch: string): Promise<void> {
  await runGit(cwd, ['checkout', branch])
}

/** Create a branch at a commit without switching to it. */
export async function branchCreate(cwd: string, name: string, commit: string): Promise<void> {
  await runGit(cwd, ['branch', name, commit])
}

/**
 * Delete local branches (`-d`; `force` switches to `-D`, which also drops
 * unmerged commits). One branch per call so a batch reports exactly which
 * names failed instead of stopping at the first one.
 */
export async function branchDelete(cwd: string, names: string[], force = false): Promise<GitBranchFailure[]> {
  const failures: GitBranchFailure[] = []
  for (const name of names) {
    try {
      await runGit(cwd, ['branch', force ? '-D' : '-d', name])
    } catch (error) {
      failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}

/**
 * Delete branches on their remote (`git push <remote> --delete <branch>`).
 * Each ref carries its remote as the first path segment, the way the panel
 * lists it (`origin/feature`), so no remote has to be passed alongside.
 * ponytail: one push per branch; batch them into a single push if deleting
 * dozens at a time ever gets slow.
 */
export async function branchDeleteRemote(cwd: string, refs: string[]): Promise<GitBranchFailure[]> {
  const remotes = (await runGit(cwd, ['remote'])).split('\n').filter(line => line !== '')
  const failures: GitBranchFailure[] = []
  for (const ref of refs) {
    const remote = remotes.find(name => ref.startsWith(`${name}/`))
    if (remote === undefined) {
      failures.push({ name: ref, message: 'unknown remote' })
      continue
    }
    try {
      await runGit(cwd, ['push', remote, '--delete', ref.slice(remote.length + 1)], 120_000)
    } catch (error) {
      failures.push({ name: ref, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}

/** Drop remote-tracking refs whose branch no longer exists on the remote. */
export async function branchPrune(cwd: string): Promise<void> {
  const remote = await preferredRemote(cwd)
  if (remote === undefined) throw new GitCommandError('no remote configured', 'git-error', 'branch prune')
  await runGit(cwd, ['remote', 'prune', remote], 120_000)
}

/**
 * Local and remote branches for the branch manager: what each branch tracks,
 * whether its upstream is gone, and whether it is already merged into HEAD —
 * the three things a cleanup decision needs. `for-each-ref` has no `-z`, but
 * no field here can contain a newline.
 */
export async function branchOverview(cwd: string): Promise<GitBranchOverview> {
  const format = '%(refname:strip=2)%1f%(upstream:short)%1f%(upstream:track)%1f%(committerdate:short)%1f%(contents:subject)'
  const [current, remote, localRaw, remoteRaw, mergedRaw] = await Promise.all([
    currentBranch(cwd).catch(() => 'HEAD'),
    preferredRemote(cwd),
    runGit(cwd, ['for-each-ref', '--sort=-committerdate', `--format=${format}`, 'refs/heads']),
    runGit(cwd, ['for-each-ref', '--sort=-committerdate', `--format=${format}`, 'refs/remotes']),
    // An unborn HEAD has nothing to compare against; nothing is merged then.
    runGit(cwd, ['for-each-ref', '--merged', 'HEAD', '--format=%(refname:strip=2)', 'refs/heads', 'refs/remotes']).catch(() => ''),
  ])
  const merged = new Set(mergedRaw.split('\n').filter(line => line !== ''))
  return {
    current,
    remote,
    local: parseBranchRows(localRaw, merged, current),
    // `origin/HEAD` is the remote's default-branch symref, not a branch to delete.
    remotes: parseBranchRows(remoteRaw, merged, current).filter(entry => !entry.name.endsWith('/HEAD')),
  }
}

/** Parse the `branchOverview` for-each-ref rows (exported for the unit test). */
export function parseBranchRows(raw: string, merged: Set<string>, current: string): GitBranchEntry[] {
  return raw.split('\n').filter(row => row !== '').map((row) => {
    const [name = '', upstream = '', track = '', date = '', subject = ''] = row.split('\x1f')
    return {
      name,
      current: name === current,
      merged: merged.has(name),
      ...(upstream === '' ? {} : { upstream }),
      gone: track.includes('gone'),
      ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
      behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
      date,
      subject,
    }
  })
}

/**
 * Patch between two revisions; with `mergeBase` the left side becomes
 * `merge-base(from, to)` (what `to` adds since the branches diverged).
 */
export async function rangeDiff(cwd: string, from: string, to: string, mergeBase = false): Promise<string> {
  const left = mergeBase ? (await runGit(cwd, ['merge-base', from, to])).trim() : from
  return runGit(cwd, ['diff', '--no-ext-diff', '--no-color', left, to])
}

/** Merge an existing branch into the current branch without opening an editor. */
export async function merge(cwd: string, branch: string): Promise<void> {
  await runGit(cwd, ['merge', '--no-edit', branch])
}

/** Replay the current branch's commits on top of an existing branch. */
export async function rebase(cwd: string, branch: string): Promise<void> {
  // --autostash: a dirty working tree no longer blocks the rebase; the changes
  // are stashed first and restored afterwards (or once the rebase concludes).
  await runGit(cwd, ['rebase', '--autostash', branch])
}

/** Fast-forward the branch to its upstream (`merge --ff-only`); a dirty working tree is fine as long as it does not touch the incoming files. */
export async function fastForward(cwd: string): Promise<void> {
  await runGit(cwd, ['merge', '--ff-only', '@{upstream}'])
}

/** Linked checkouts for this repository, with the caller's checkout marked. */
export async function worktrees(cwd: string): Promise<GitWorktree[]> {
  const [root, raw] = await Promise.all([
    repoRoot(cwd),
    runGit(cwd, ['worktree', 'list', '--porcelain', '-z']),
  ])
  return parseWorktreePorcelainZ(raw).map(entry => ({ ...entry, current: entry.path === root }))
}

/** Add a linked checkout for an existing branch. */
/** Returns the canonical absolute path, matching how DSH stores workspace and session cwd. */
export async function addWorktree(cwd: string, path: string, branch: string, base?: string): Promise<string> {
  await runGit(cwd, ['worktree', 'add', ...(base === undefined ? [] : ['-b', branch]), '--', path, base ?? branch])
  return realpathSync(resolve(cwd, path))
}

export async function worktreePathPrefix(cwd: string): Promise<string> {
  const root = await repoRoot(cwd)
  return `${join(dirname(root), `${basename(root)}-worktrees`)}${sep}`
}

/** Merge only inside a registered Worktree of the same repository. */
export async function mergeWorktree(cwd: string, targetPath: string, sourceBranch: string): Promise<void> {
  let canonical: string
  try {
    canonical = realpathSync(targetPath)
  } catch {
    throw new GitCommandError('unknown target worktree', 'git-error', 'worktree merge')
  }
  const target = (await worktrees(cwd)).find(entry => {
    try { return realpathSync(entry.path) === canonical } catch { return false }
  })
  if (target === undefined) throw new GitCommandError('unknown target worktree', 'git-error', 'worktree merge')
  await merge(target.path, sourceBranch)
}

/** Remove a clean linked checkout; git refuses dirty/current/locked trees. */
export async function removeWorktree(cwd: string, path: string): Promise<void> {
  await runGit(cwd, ['worktree', 'remove', '--', path])
}

/** In-progress history operation for conflict recovery controls. */
export async function operation(cwd: string): Promise<GitOperation | null> {
  try {
    await runGit(cwd, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])
    return 'merge'
  } catch { /* no merge */ }
  for (const name of ['rebase-merge', 'rebase-apply']) {
    const path = (await runGit(cwd, ['rev-parse', '--git-path', name])).trim()
    if (existsSync(resolve(cwd, path))) return 'rebase'
  }
  return null
}

export async function continueOperation(cwd: string, kind: GitOperation): Promise<void> {
  await runGit(cwd, ['-c', 'core.editor=true', kind, '--continue'])
}

export async function abortOperation(cwd: string, kind: GitOperation): Promise<void> {
  await runGit(cwd, [kind, '--abort'])
}

/**
 * Recent commit history across every branch (newest first, date order so the
 * client graph stays consistent while paging), lazily pageable via skip/count.
 */
export async function log(cwd: string, count = 30, skip = 0): Promise<GitLogEntry[]> {
  const raw = await runGit(cwd, [
    'log', '--all', '--date-order', '-n', String(count), '--skip', String(skip), '--decorate=short',
    '--pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D%x1f%P',
  ])
  return parseLogLines(raw)
}

/**
 * Content of a file at a revision (`git show <rev>:<path>`), or null when the
 * revision has no such path (a new/untracked file has no HEAD side).
 */
export async function show(cwd: string, rev: string, path: string): Promise<string | null> {
  try {
    return await runGit(cwd, ['show', `${rev}:${path}`])
  } catch {
    return null
  }
}

/** Full patch text of one commit (`git show` with the commit header suppressed).
 *  Merge commits show their diff against the first parent (`-m --first-parent`
 *  is a no-op for regular commits), so a history click always has content. */
export async function commitDiff(cwd: string, hash: string): Promise<string> {
  return runGit(cwd, ['show', '--no-ext-diff', '--no-color', '--format=', '-m', '--first-parent', hash])
}

/** Whether HEAD carries this path; an unborn HEAD carries nothing. */
async function inHead(cwd: string, path: string): Promise<boolean> {
  const listed = await runGit(cwd, ['ls-tree', '-z', 'HEAD', '--', path]).catch(() => '')
  return listed !== ''
}

/**
 * Discard one path's worktree changes. A path HEAD carries is restored from
 * the index (`git checkout -- <path>`, which leaves the index untouched). A
 * path HEAD does not carry has no baseline to restore: it is a file the change
 * being discarded created, so discarding it removes the file. `git checkout`
 * is wrong there — the index holds the addition, so it would rewrite the file
 * from the index and report success without changing anything.
 */
export async function discard(cwd: string, path: string): Promise<void> {
  if (await inHead(cwd, path)) {
    await runGit(cwd, ['checkout', '--', path])
    return
  }
  // -f covers an addition already edited or deleted in the worktree;
  // --ignore-unmatch covers a path the index never carried (untracked).
  await runGit(cwd, ['rm', '-q', '-f', '--ignore-unmatch', '--', path])
  await rm(path, { force: true })
}

/**
 * Discard index/worktree changes and remove untracked files and directories.
 * Ignored files and nested repositories are not cleaned.
 */
export async function discardAll(cwd: string): Promise<void> {
  const root = await repoRoot(cwd)
  await runGit(root, ['reset', '--hard'])
  await runGit(root, ['clean', '-fd'])
}

/** Revert one commit onto the current branch with an auto-generated message. */
export async function revert(cwd: string, hash: string): Promise<void> {
  await runGit(cwd, ['revert', '--no-edit', hash])
}

/** Cherry-pick one commit onto the current branch. */
export async function cherryPick(cwd: string, hash: string): Promise<void> {
  await runGit(cwd, ['cherry-pick', hash])
}

/**
 * Every tag, newest-created first. `for-each-ref` has no `-z`, so the rows are
 * newline-separated — safe here because neither a ref name nor
 * `%(contents:subject)` can contain a newline. A lightweight tag has no
 * annotation, so git falls back to the tagged commit's subject.
 */
export async function tags(cwd: string): Promise<GitTagEntry[]> {
  const remote = await preferredRemote(cwd)
  const [raw, remoteRaw] = await Promise.all([
    runGit(cwd, [
      'for-each-ref', '--sort=-creatordate', '--format=%(refname:strip=2)%1f%(contents:subject)%1f%(objectname)', 'refs/tags',
    ]),
    remote === undefined ? null : remoteTagRefs(cwd, remote),
  ])
  return raw.split('\n').filter(row => row !== '').map((row) => {
    const [name = '', subject = '', object = ''] = row.split('\x1f')
    const remoteState = remoteRaw === null ? 'unknown' : remoteRaw.get(name) === object ? 'synced' : 'local'
    return { name, subject, remoteState }
  })
}

/** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
export async function createTag(cwd: string, name: string, message?: string, commit?: string): Promise<void> {
  const annotate = message !== undefined && message !== '' ? ['-a', '-m', message] : []
  await runGit(cwd, ['tag', ...annotate, name, ...(commit === undefined ? [] : [commit])])
}

/** Delete a local tag (the remote copy, if any, is untouched). */
export async function deleteTag(cwd: string, name: string): Promise<void> {
  await runGit(cwd, ['tag', '-d', name])
}

/**
 * Push one tag. `origin` is the near-universal name, but a repository whose
 * single remote is called something else should still work, so fall back to
 * the first configured remote rather than failing on a hard-coded name.
 */
async function preferredRemote(cwd: string): Promise<string | undefined> {
  const names = (await runGit(cwd, ['remote'])).split('\n').filter(line => line !== '')
  return names.includes('origin') ? 'origin' : names[0]
}

async function remoteTagRefs(cwd: string, remote: string): Promise<Map<string, string> | null> {
  const key = `${cwd}\0${remote}`
  const cached = remoteTagCache.get(key)
  if (cached !== undefined && cached.expires > Date.now()) return cached.refs
  const raw = await runGit(cwd, ['ls-remote', '--tags', '--refs', remote], 3_000).catch(() => null)
  const refs = raw === null ? null : new Map(raw.split('\n').filter(Boolean).map((row) => {
    const [object, ref] = row.split('\t')
    return [ref?.replace(/^refs\/tags\//, '') ?? '', object ?? '']
  }))
  remoteTagCache.set(key, { expires: Date.now() + 60_000, refs })
  return refs
}

export async function pushTag(cwd: string, name: string): Promise<void> {
  const remote = await preferredRemote(cwd)
  if (remote === undefined) throw new GitCommandError('no remote configured', 'git-error', 'push tag')
  await runGit(cwd, ['push', remote, `refs/tags/${name}`], 120_000)
  remoteTagCache.delete(`${cwd}\0${remote}`)
}

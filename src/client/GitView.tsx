/**
 * The source-control panel: status list (staged vs unstaged), stage/unstage,
 * the stash stack (save / pop / apply / drop), commit with a message box,
 * branch switch, and a VSCode-like history — rows
 * carry branch decorations, author and relative time. Clicking a changed
 * file or a history row opens a dedicated diff TAB (see {@link DiffTab}),
 * placed below the git pane on first use. File rows and history rows open a
 * right-click context menu with advanced operations (open in editor, discard,
 * revert, cherry-pick, copy paths/hashes). Refresh is manual + on mount/
 * focus, plus a 5 s poll while the tab is visible (no file watcher — KISS).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type UIEvent } from 'react'
import {
  Button, IconBranchOutline16, IconChevronRightOutline14, IconCodeOutline16, IconCopyOutline16, IconEllipsisOutline16, IconRefreshOutline16,
  IconTrashOutline16, Input, Menu, Modal, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitLogEntry, GitOperation, GitStashEntry, GitStatusEntry, GitStatusResult, GitTagEntry, GitWorktree, SessionScope } from './api.ts'
import { api } from './api.ts'
import { layoutGraph, type GraphRow } from './graph.ts'
import { relativeTo } from './paths.ts'
import { relativeTime, t } from './locales.ts'
import type { SidebarTab } from './state.ts'
import css from './sidebar.module.css'

/** The XY status letters a row badge shows (X = index, Y = worktree). */
function badgeOf(entry: GitStatusEntry): string {
  const index = entry.xy[0]
  const worktree = entry.xy[1]
  if (index !== undefined && index !== ' ' && index !== '?') return index
  if (worktree !== undefined && worktree !== ' ' && worktree !== '?') return worktree
  return '?'
}

/** The badge color class for a status letter (M amber, A/? green, D red). */
function badgeTone(letter: string): string | undefined {
  if (letter === 'M' || letter === 'R') return css.gitBadgeModified
  if (letter === 'A' || letter === '?') return css.gitBadgeAdded
  if (letter === 'D') return css.gitBadgeDeleted
  return undefined
}

/** Whether the entry carries STAGED (index) changes — the X letter is set. */
function isStagedEntry(entry: GitStatusEntry): boolean {
  const index = entry.xy[0]
  return index !== undefined && index !== ' ' && index !== '?'
}

/** Whether the entry carries UNSTAGED (worktree) changes — the Y letter is set
 *  (untracked `??` counts as unstaged: it is a worktree-only change). A file
 *  with both letters set ('MM') lands in BOTH sections. */
function isUnstagedEntry(entry: GitStatusEntry): boolean {
  if (entry.xy === '??') return true
  const worktree = entry.xy[1]
  return worktree !== undefined && worktree !== ' ' && worktree !== '?'
}

/** Whether the entry is untracked (`??`): git diff never includes it. */
function isUntracked(entry: GitStatusEntry): boolean {
  return badgeOf(entry) === '?'
}

const GRAPH_LANE = 14
const GRAPH_ROW = 32
const GRAPH_COLORS = ['#2f6fdb', '#d0741c', '#2a9d5c', '#b84bd6', '#d63b5f', '#1f9fb5']

/** The SVG rails of one history row (see {@link layoutGraph}). */
function GraphCell(props: { row: GraphRow; lanes: number }) {
  const { row, lanes } = props
  const x = (lane: number): number => lane * GRAPH_LANE + GRAPH_LANE / 2
  const color = (lane: number): string => GRAPH_COLORS[lane % GRAPH_COLORS.length]!
  const mid = GRAPH_ROW / 2
  const cx = x(row.lane)
  return (
    <svg className={css.gitGraph} width={lanes * GRAPH_LANE} height={GRAPH_ROW} aria-hidden="true">
      {row.incoming && <line x1={cx} y1={0} x2={cx} y2={mid} stroke={color(row.lane)} strokeWidth={2} />}
      {row.through.map(lane => (
        <line key={`t${lane}`} x1={x(lane)} y1={0} x2={x(lane)} y2={GRAPH_ROW} stroke={color(lane)} strokeWidth={2} />
      ))}
      {row.joins.map(lane => (
        <path key={`j${lane}`} d={`M${x(lane)} 0 C ${x(lane)} ${mid} ${cx} 0 ${cx} ${mid}`} fill="none" stroke={color(lane)} strokeWidth={2} />
      ))}
      {row.parents.map((lane, order) => (
        lane === row.lane
          ? <line key={`p${order}`} x1={cx} y1={mid} x2={cx} y2={GRAPH_ROW} stroke={color(lane)} strokeWidth={2} />
          : <path key={`p${order}`} d={`M${cx} ${mid} C ${cx} ${GRAPH_ROW} ${x(lane)} ${mid} ${x(lane)} ${GRAPH_ROW}`} fill="none" stroke={color(lane)} strokeWidth={2} />
      ))}
      <circle cx={cx} cy={mid} r={4} fill={color(row.lane)} />
    </svg>
  )
}

/** The last path segment (tab title for a file's diff). */
function baseName(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

/** The ref names of one log row's decorations (`HEAD -> main` → `main`), deduped. */
function refNames(refs: string): string[] {
  return [...new Set(
    refs
      .split(',')
      .map(ref => ref.trim())
      .filter(ref => ref !== '')
      .map(ref => (ref.includes(' -> ') ? ref.slice(ref.indexOf(' -> ') + 4) : ref))
      .map(ref => (ref.startsWith('tag: ') ? ref.slice(5) : ref)),
  )]
}

/** The pending destructive action (discard / revert / cherry-pick), gated by a confirm modal. */
interface ConfirmState {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
}

/** History batch size: the log loads lazily in pages so a long history never
 *  floods the panel at once (the end of the log is reached by paging). */
const LOG_BATCH = 20

/** Folding state of the four sections. */
type SectionState = { changes: boolean; stash: boolean; tag: boolean; history: boolean }
const DEFAULT_SECTIONS: SectionState = { changes: true, stash: false, tag: false, history: true }

/**
 * What a Git view remembers across remounts (the shell unmounts a tab's body
 * when another tab is shown): folding, how much history was paged in, and
 * the scroll offset of every scroll box, keyed by session.
 */
interface ViewMemory { expanded: SectionState; logCount: number; scroll: Record<string, number> }
const viewMemory = new Map<string, ViewMemory>()
/** Forget every remembered view (tests isolate cases with it). */
export function resetViewMemory(): void { viewMemory.clear() }
function memoryFor(sessionId: string): ViewMemory {
  let memory = viewMemory.get(sessionId)
  if (memory === undefined) {
    memory = { expanded: { ...DEFAULT_SECTIONS }, logCount: 0, scroll: {} }
    viewMemory.set(sessionId, memory)
  }
  return memory
}
/** Distance from the history list's bottom (px) at which the next page is fetched. */
const LOAD_MORE_THRESHOLD = 48
/** Background status poll interval while the panel is visible. */
const AUTO_REFRESH_MS = 5000

/** Start a worktree draft on a new branch based on the current branch. */
export function defaultWorktreeDraft(currentBranch: string, pathPrefix: string) {
  return {
    createNew: true,
    newBranch: '',
    base: currentBranch,
    path: `${pathPrefix}new-branch`,
  } as const
}

const INITIAL_WORKTREE_DRAFT = defaultWorktreeDraft('', '')

export function GitView(props: {
  scope: SessionScope
  onOpenFile: (path: string) => void | Promise<void>
  /** Register the Worktree as a DSH Workspace, create a session, and open it. */
  onOpenWorktree: (path: string) => Promise<void>
  /** Open a diff tab (the shell places it below the git pane on first use). */
  onOpenDiff: (tab: SidebarTab) => void
  /** Queue a text prompt into the session's chat (history row "add to chat" / "explain"). */
  onPrompt: (text: string) => Promise<void>
}) {
  const { scope, onOpenFile, onOpenDiff, onOpenWorktree, onPrompt } = props
  const viewId = useId()
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [logEntries, setLogEntries] = useState<GitLogEntry[]>([])
  const [stashEntries, setStashEntries] = useState<GitStashEntry[]>([])
  const [tagEntries, setTagEntries] = useState<GitTagEntry[]>([])
  const [commitMsg, setCommitMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<string | null>(null)
  const [rebaseTarget, setRebaseTarget] = useState<string | null>(null)
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([])
  const [worktreeOpen, setWorktreeOpen] = useState(false)
  const [worktreeBranch, setWorktreeBranch] = useState('')
  const [worktreePath, setWorktreePath] = useState('')
  const [worktreePathPrefix, setWorktreePathPrefix] = useState('')
  // A checked-out branch cannot be attached to a second worktree, so the draft
  // creates a new branch and uses the current branch as its base.
  const [worktreeCreateNew, setWorktreeCreateNew] = useState<boolean>(INITIAL_WORKTREE_DRAFT.createNew)
  const [worktreeNewBranch, setWorktreeNewBranch] = useState<string>(INITIAL_WORKTREE_DRAFT.newBranch)
  const [worktreeBase, setWorktreeBase] = useState(INITIAL_WORKTREE_DRAFT.base)
  const [worktreeError, setWorktreeError] = useState<string | null>(null)
  const [worktreeMerge, setWorktreeMerge] = useState<GitWorktree | null>(null)
  const [worktreeTarget, setWorktreeTarget] = useState('')
  const [operation, setOperation] = useState<GitOperation | null>(null)
  const graph = useMemo(() => layoutGraph(logEntries), [logEntries])
  /** Whether the history was fully paged (a batch shorter than LOG_BATCH). */
  const [logEnded, setLogEnded] = useState(false)
  const [logLoadingMore, setLogLoadingMore] = useState(false)

  /** The open file-row context menu (cursor position for the portaled Menu). */
  const [fileMenu, setFileMenu] = useState<{ entry: GitStatusEntry; staged: boolean; x: number; y: number } | null>(null)
  /** The open stash-row context menu. */
  const [stashMenu, setStashMenu] = useState<{ entry: GitStashEntry; x: number; y: number } | null>(null)
  /** The last failed stash operation, shown inside the stash section itself. */
  const [stashError, setStashError] = useState<string | null>(null)
  /** The open tag-row context menu. */
  const [tagMenu, setTagMenu] = useState<{ entry: GitTagEntry; x: number; y: number } | null>(null)
  /** The last failed tag operation, shown inside the tag section itself. */
  const [tagError, setTagError] = useState<string | null>(null)
  /** The open create-tag draft; `commit` null means HEAD. */
  const [tagDraft, setTagDraft] = useState<{ commit: GitLogEntry | null; name: string; message: string } | null>(null)
  /** A failed create, shown inside the create dialog so the input survives a retry. */
  const [tagDraftError, setTagDraftError] = useState<string | null>(null)
  /** The open create-branch draft (commit the branch starts from). */
  const [branchDraft, setBranchDraft] = useState<{ commit: GitLogEntry; name: string } | null>(null)
  const [branchDraftError, setBranchDraftError] = useState<string | null>(null)
  /** Whether the history box is scrolled far enough for a "back to top" affordance. */
  const [historyScrolled, setHistoryScrolled] = useState(false)
  /** "Compare with…": the first commit picked; the next history row click opens the range diff. */
  const [compareFrom, setCompareFrom] = useState<GitLogEntry | null>(null)
  /** The open history-row context menu. */
  const [historyMenu, setHistoryMenu] = useState<{ entry: GitLogEntry; x: number; y: number } | null>(null)
  /** The pending destructive action awaiting confirmation. */
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const memory = memoryFor(scope.sessionId)
  const [expandedSections, setExpandedSections] = useState<SectionState>(() => ({ ...memory.expanded }))
  useEffect(() => { memory.expanded = expandedSections }, [memory, expandedSections])
  /** Scroll boxes report their offset here; the first render after a remount puts it back. */
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollProps = (key: string) => ({
    'data-scroll-key': key,
    onScroll: (event: UIEvent<HTMLDivElement>) => { memory.scroll[key] = event.currentTarget.scrollTop },
  })

  /** How much history is on screen, so a background refresh re-reads that much, not just page one. */
  const logCountRef = useRef(memory.logCount)
  useEffect(() => {
    if (logEntries.length > 0) {
      logCountRef.current = logEntries.length
      memory.logCount = logEntries.length
    }
  }, [memory, logEntries])

  /** Reload everything; `silent` skips the loading placeholder (background polls). */
  const refresh = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true)
    setError(null)
    const logCount = Math.max(LOG_BATCH, logCountRef.current)
    try {
      const [statusResult, branchResult, logResult, worktreeResult, operationResult, stashResult, tagResult] = await Promise.all([
        api.gitStatus(scope),
        api.gitBranch(scope).catch(() => ({ current: '', names: [] as string[] })),
        // Every page already loaded; further pages arrive via "load more".
        api.gitLog(scope, logCount, 0).catch(() => [] as GitLogEntry[]),
        api.gitWorktrees(scope).catch(() => ({ entries: [] as GitWorktree[], pathPrefix: '' })),
        api.gitOperation(scope).catch(() => ({ operation: null })),
        api.gitStashList(scope).catch(() => ({ entries: [] as GitStashEntry[] })),
        api.gitTags(scope).catch(() => ({ entries: [] as GitTagEntry[] })),
      ])
      setStatus(statusResult)
      setBranchNames(branchResult.names)
      setLogEntries(logResult)
      setLogEnded(logResult.length < logCount)
      setWorktrees(worktreeResult.entries)
      setWorktreePathPrefix(worktreeResult.pathPrefix)
      setOperation(operationResult.operation)
      setStashEntries(stashResult.entries)
      setTagEntries(tagResult.entries)
      const available = branchResult.names.filter(name => !worktreeResult.entries.some(entry => entry.branch === name))
      setWorktreeBranch(branch => available.includes(branch) ? branch : available[0] ?? '')
      setWorktreeBase(base => branchResult.names.includes(base) ? base : branchResult.current)
      setWorktreePath(path => path !== '' ? path : `${worktreeResult.pathPrefix}${(available[0] ?? 'new-worktree').replace(/[^\w.-]+/g, '-')}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [scope.sessionId, scope.cwd])

  useEffect(() => { void refresh() }, [refresh])

  // Restore every scroll box once the first load has painted the lists.
  const restoredRef = useRef(false)
  useLayoutEffect(() => {
    if (loading || restoredRef.current || rootRef.current === null) return
    restoredRef.current = true
    for (const box of rootRef.current.querySelectorAll<HTMLElement>('[data-scroll-key]')) {
      const key = box.dataset.scrollKey!
      if (memory.scroll[key] !== undefined) box.scrollTop = memory.scroll[key]
    }
  }, [loading, memory])

  // Keep the panel current without a file watcher: poll while the tab is
  // visible, and re-read when the window regains focus. Skipped mid-operation
  // so a poll cannot race a running git command's own refresh.
  const busyRef = useRef(busy)
  busyRef.current = busy || logLoadingMore
  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState === 'visible' && !busyRef.current) void refresh(true)
    }
    const timer = setInterval(tick, AUTO_REFRESH_MS)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh])

  /** Append the next history page (lazy: only when the user asks for more). */
  const loadMoreLog = async (): Promise<void> => {
    if (logLoadingMore || logEnded) return
    setLogLoadingMore(true)
    try {
      const next = await api.gitLog(scope, LOG_BATCH, logEntries.length)
      setLogEntries(entries => [...entries, ...next])
      if (next.length < LOG_BATCH) setLogEnded(true)
    } catch (reason) {
      setCommitError(`${t('historyLoadError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setLogLoadingMore(false)
    }
  }

  /** Scroll the history back to the top and drop the paged-in tail (back to page one). */
  const backToTop = (): void => {
    const box = rootRef.current?.querySelector<HTMLElement>('[data-scroll-key="history"]')
    if (box !== null && box !== undefined) box.scrollTop = 0
    memory.scroll.history = 0
    setHistoryScrolled(false)
    if (logEntries.length > LOG_BATCH) {
      setLogEntries(entries => entries.slice(0, LOG_BATCH))
      setLogEnded(false)
      logCountRef.current = LOG_BATCH
      memory.logCount = LOG_BATCH
    }
  }

  /** The diff tab for one changed file (one tab per path+side; same id = focused). */
  const openWorktreeDiff = (entry: GitStatusEntry, staged: boolean): void => {
    onOpenDiff({
      id: `diff:w:${staged ? 's' : 'u'}:${entry.path}`,
      type: 'diff',
      title: baseName(entry.path),
      diff: { kind: 'worktree', path: entry.path, staged, untracked: isUntracked(entry) },
    })
  }

  /** The diff tab for one commit (one tab per commit). */
  /** Local branch names decorating a history row (remote refs and HEAD excluded). */
  const localBranchesAt = (entry: GitLogEntry): string[] =>
    refNames(entry.refs).filter(name => name !== 'HEAD' && !name.startsWith('tag: ') && branchNames.includes(name))

  const openRangeDiff = (from: string, to: string, mergeBase: boolean, title: string): void => {
    onOpenDiff({ id: `diff:r:${from}..${to}:${mergeBase ? 'mb' : 'raw'}`, type: 'diff', title, diff: { kind: 'range', from, to, mergeBase, title } })
  }

  const createBranch = async (): Promise<void> => {
    const draft = branchDraft
    if (draft === null || draft.name.trim() === '' || busy) return
    setBusy(true)
    setBranchDraftError(null)
    try {
      await api.gitBranchCreate(scope, draft.name.trim(), draft.commit.hashFull)
      setBranchDraft(null)
      await refresh()
    } catch (reason) {
      setBranchDraftError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const sendPrompt = async (text: string): Promise<void> => {
    try {
      await onPrompt(text)
    } catch (reason) {
      setCommitError(`${t('promptError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  /** A history row click opens its diff, or finishes a pending "compare with…". */
  const pickHistoryRow = (entry: GitLogEntry): void => {
    if (compareFrom === null) {
      openCommitDiff(entry)
      return
    }
    const from = compareFrom
    setCompareFrom(null)
    if (from.hashFull !== entry.hashFull) openRangeDiff(from.hashFull, entry.hashFull, false, `${from.hash} ↔ ${entry.hash}`)
  }

  const openCommitDiff = (entry: GitLogEntry): void => {
    onOpenDiff({
      id: `diff:c:${entry.hashFull}`,
      type: 'diff',
      title: `${entry.hash} ${entry.subject}`,
      diff: { kind: 'commit', hash: entry.hash, hashFull: entry.hashFull, subject: entry.subject },
    })
  }

  const stageEntry = async (entry: GitStatusEntry, staged: boolean): Promise<void> => {
    setBusy(true)
    try {
      if (staged) await api.gitUnstage(scope, entry.path)
      else await api.gitStage(scope, entry.path)
      await refresh()
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const stageAll = async (staged: boolean): Promise<void> => {
    setBusy(true)
    try {
      if (staged) await api.gitUnstage(scope)
      else await api.gitStage(scope)
      await refresh()
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }


  /** Run one stash operation, then refresh; failures surface like a failed commit. */
  const runStashAction = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setStashError(null)
    try {
      await action()
      await refresh()
    } catch (reason) {
      setStashError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  /** Run one tag operation, then refresh; failures surface inside the tag section. */
  const runTagAction = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setTagError(null)
    try {
      await action()
      await refresh()
    } catch (reason) {
      setTagError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  /** Create the drafted tag. The dialog stays open on failure so a rejected
   *  name can be corrected without retyping the message. */
  const createTag = async (): Promise<void> => {
    const draft = tagDraft
    if (draft === null || draft.name.trim() === '' || busy) return
    setBusy(true)
    setTagDraftError(null)
    setTagError(null)
    try {
      await api.gitTagCreate(scope, draft.name.trim(), draft.message.trim(), draft.commit?.hashFull)
      setTagDraft(null)
      await refresh()
    } catch (reason) {
      setTagDraftError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const commit = async (): Promise<void> => {
    const message = commitMsg.trim()
    if (message === '' || busy) return
    setBusy(true)
    setCommitError(null)
    try {
      await api.gitCommit(scope, message)
      setCommitMsg('')
      await refresh()
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const checkout = async (branch: string): Promise<void> => {
    if (branch === status?.branch || busy) return
    setBusy(true)
    setCommitError(null)
    try {
      await api.gitCheckout(scope, branch)
      await refresh()
    } catch (reason) {
      setCommitError(`${t('checkoutError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  /** 'sync' = fetch, then push when the branch is ahead (the header button). */
  const syncRemote = async (action: 'sync' | 'fetch-all' | 'push'): Promise<void> => {
    if (busy) return
    setBusy(true)
    setCommitError(null)
    try {
      if (action === 'push') await api.gitPush(scope)
      else await api.gitFetch(scope, action === 'fetch-all')
      if (action === 'sync' && (status?.ahead ?? 0) > 0) await api.gitPush(scope)
      await refresh()
    } catch (reason) {
      const label = action === 'sync' ? t('syncError') : action === 'push' ? t('pushError') : t('fetchError')
      setCommitError(`${label}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  const merge = async (branch: string): Promise<void> => {
    setBusy(true)
    setCommitError(null)
    try {
      await api.gitMerge(scope, branch)
    } catch (reason) {
      setCommitError(`${t('mergeError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  const addWorktree = async (): Promise<void> => {
    const path = worktreePath.trim()
    const branch = worktreeCreateNew ? worktreeNewBranch.trim() : worktreeBranch
    if (path === '' || branch === '' || busy) return
    setBusy(true)
    setWorktreeError(null)
    try {
      await api.gitWorktreeAdd(scope, path, branch, worktreeCreateNew ? worktreeBase : undefined)
      setWorktreePath('')
      await refresh()
    } catch (reason) {
      setWorktreeError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const rebase = async (branch: string): Promise<void> => {
    setBusy(true)
    setCommitError(null)
    try {
      await api.gitRebase(scope, branch)
    } catch (reason) {
      setCommitError(`${t('rebaseError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  const openWorktree = async (path: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    setWorktreeError(null)
    try {
      await onOpenWorktree(path)
    } catch (reason) {
      setWorktreeError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const mergeWorktree = async (entry: GitWorktree, remove: boolean): Promise<void> => {
    const target = worktrees.find(candidate => candidate.path === worktreeTarget)
    if (entry.branch === undefined || target === undefined || busy) return
    setWorktreeMerge(null)
    setBusy(true)
    setCommitError(null)
    try {
      await api.gitWorktreeMerge(scope, target.path, entry.branch)
      if (remove) await api.gitWorktreeRemove(scope, entry.path)
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      await refresh()
      try {
        await onOpenWorktree(target.path)
      } catch (reason) {
        setCommitError(reason instanceof Error ? reason.message : String(reason))
      }
      setBusy(false)
    }
  }

  const finishOperation = async (abort: boolean): Promise<void> => {
    if (operation === null || busy) return
    setBusy(true)
    setCommitError(null)
    try {
      if (abort) await api.gitOperationAbort(scope, operation)
      else await api.gitOperationContinue(scope, operation)
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  /** Run one destructive operation after the confirm modal, then refresh. */
  const runConfirmed = (confirmState: ConfirmState, reportError = setCommitError): void => {
    setConfirm({ ...confirmState, onConfirm: async () => {
      setBusy(true)
      reportError(null)
      try {
        await confirmState.onConfirm()
        await refresh()
      } catch (reason) {
        reportError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setBusy(false)
      }
    } })
  }

  /** Copy `text` to the clipboard (best-effort; no visual feedback needed — the menu closes). */
  const copy = (text: string): void => {
    void writeClipboard(text)
  }

  const openFileMenu = (event: MouseEvent, entry: GitStatusEntry, staged: boolean): void => {
    event.preventDefault()
    event.stopPropagation()
    setFileMenu({ entry, staged, x: event.clientX, y: event.clientY })
  }

  /** The stash-row menu opens on left OR right click: a right-click-only menu
   *  on a fresh section is not discoverable, and the row has no other action. */
  const openStashMenu = (event: MouseEvent, entry: GitStashEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setStashMenu({ entry, x: event.clientX, y: event.clientY })
  }

  /** The tag-row menu opens on left OR right click, for the same reason as the stash row. */
  const openTagMenu = (event: MouseEvent, entry: GitTagEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setTagMenu({ entry, x: event.clientX, y: event.clientY })
  }

  const openHistoryMenu = (event: MouseEvent, entry: GitLogEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setHistoryMenu({ entry, x: event.clientX, y: event.clientY })
  }

  const entries = status?.entries ?? []
  const stagedEntries = entries.filter(isStagedEntry)
  /** Whether "stage all" has nothing left to do (every row fully staged). */
  const allStaged = entries.length > 0 && entries.every(entry => isStagedEntry(entry) && !isUnstagedEntry(entry))
  const discardableCount = new Set(entries.filter(entry => !isUntracked(entry)).map(entry => entry.path)).size

  const toggleSection = (section: keyof typeof expandedSections): void => {
    setExpandedSections(current => ({ ...current, [section]: !current[section] }))
  }

  /** One row per path: the checkbox IS the stage toggle ('MM' shows indeterminate). */
  const renderEntry = (entry: GitStatusEntry): ReactNode => {
    const staged = isStagedEntry(entry) && !isUnstagedEntry(entry)
    const partial = isStagedEntry(entry) && isUnstagedEntry(entry)
    return (
      <div key={entry.path} className={css.gitRow}>
        <input
          type="checkbox"
          className={css.gitCheck}
          checked={staged}
          ref={(el) => { if (el !== null) el.indeterminate = partial }}
          aria-label={staged ? t('unstage') : t('stage')}
          title={staged ? t('unstage') : t('stage')}
          disabled={busy}
          onChange={() => { void stageEntry(entry, staged) }}
        />
        <button
          type="button"
          className={css.gitRowMain}
          title={entry.path}
          onClick={() => { openWorktreeDiff(entry, staged) }}
          onContextMenu={(event) => { openFileMenu(event, entry, staged) }}
        >
          <span className={`${css.gitBadge} ${badgeTone(badgeOf(entry)) ?? ''}`}>{badgeOf(entry)}</span>
          <span className={css.gitName}>{entry.path}</span>
        </button>
        {(isUntracked(entry) || staged) && <span className={css.gitRowHint}>{isUntracked(entry) ? t('untracked') : t('staged')}</span>}
        <span className={css.gitRowActions}>
          <button type="button" className={css.iconButton} aria-label={t('viewDiff')} title={t('viewDiff')} onClick={() => { openWorktreeDiff(entry, staged) }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12M2 4h8M2 12h8" /></svg>
          </button>
          {!isUntracked(entry) && (
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('discard')}
              title={t('discard')}
              disabled={busy}
              onClick={() => {
                runConfirmed({
                  title: t('discardTitle'),
                  description: t('discardDesc', { path: entry.path }),
                  confirmLabel: t('discard'),
                  onConfirm: () => api.gitDiscard(scope, entry.path),
                })
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4L2 8l4 4M2 8h8a3 3 0 010 6" /></svg>
            </button>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className={css.git} ref={rootRef} {...scrollProps('root')}>
      <div className={css.gitHeader}>
        <select
          className={css.gitBranchSelect}
          value={status?.branch ?? ''}
          onChange={(event) => { void checkout(event.target.value) }}
          disabled={busy || (status !== null && !status.isRepo)}
        >
          {(status?.branch ?? '') !== '' && <option value={status!.branch}>{status!.branch}</option>}
          {branchNames.filter(name => name !== status?.branch).map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button
          type="button"
          className={css.gitSyncButton}
          title={t('syncTitle')}
          disabled={busy || (status !== null && !status.isRepo) || status?.branch === 'HEAD'}
          onClick={() => { void syncRemote('sync') }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 13V3M2 6l3-3 3 3M11 3v10M8 10l3 3 3-3" /></svg>
          <span>{t('sync')}</span>
          {(status?.behind ?? 0) > 0 && <span className={css.gitSyncBadge}>↓{status!.behind}</span>}
          {(status?.ahead ?? 0) > 0 && <span className={css.gitSyncBadge}>↑{status!.ahead}</span>}
        </button>
        <Menu
          open={branchMenuOpen}
          onClose={() => { setBranchMenuOpen(false) }}
          items={[
            { type: 'label', id: 'label-remote', text: t('groupRemote') },
            { id: 'fetch-all', label: t('fetchAll') },
            { id: 'push', label: t('pushBranch'), disabled: status?.branch === 'HEAD' },
            { type: 'separator', id: 'remote-separator' },
            { type: 'label', id: 'label-branch', text: t('groupBranch') },
            { id: 'merge', label: t('mergeBranchMenu'), disabled: branchNames.every(name => name === status?.branch) },
            { id: 'rebase', label: t('rebaseBranchMenu'), disabled: branchNames.every(name => name === status?.branch) },
            { id: 'worktree', label: t('worktreesMenu') },
            { type: 'separator', id: 'branch-separator' },
            { type: 'label', id: 'label-worktree', text: t('groupWorkingTree') },
            { id: 'stage-all', label: allStaged ? t('unstageAll') : t('stageAll'), disabled: entries.length === 0 },
            { id: 'stash-save', label: t('stashSave'), disabled: entries.length === 0 },
            { id: 'tag-new', label: t('tagNewMenu') },
            { id: 'discard-all', label: t('discardAll'), danger: true, disabled: discardableCount === 0 },
            { type: 'separator', id: 'refresh-separator' },
            { id: 'refresh', label: t('refresh') },
          ]}
          onSelect={(id) => {
            const branch = branchNames.find(name => name !== status?.branch) ?? null
            setBranchMenuOpen(false)
            if (id === 'fetch-all' || id === 'push') void syncRemote(id)
            if (id === 'refresh') void refresh()
            if (id === 'stage-all') void stageAll(allStaged)
            if (id === 'stash-save') void runStashAction(() => api.gitStash(scope))
            if (id === 'tag-new') { setTagDraftError(null); setTagDraft({ commit: null, name: '', message: '' }) }
            if (id === 'discard-all') {
              runConfirmed({
                title: t('discardAllTitle'),
                description: t('discardAllDesc', { count: discardableCount }),
                confirmLabel: t('discardAll'),
                onConfirm: () => api.gitDiscardAll(scope),
              })
            }
            if (id === 'merge') setMergeSource(branch)
            if (id === 'rebase') setRebaseTarget(branch)
            if (id === 'worktree') {
              const draft = defaultWorktreeDraft(status?.branch ?? '', worktreePathPrefix)
              setWorktreeError(null)
              setWorktreeCreateNew(draft.createNew)
              setWorktreeNewBranch(draft.newBranch)
              setWorktreeBase(draft.base)
              setWorktreePath(draft.path)
              setWorktreeOpen(true)
            }
          }}
          portal
          align="end"
          compact
          anchor={(
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('branchActions')}
              title={t('branchActions')}
              disabled={busy}
              onClick={() => { setBranchMenuOpen(open => !open) }}
            >
              <IconEllipsisOutline16 size={16} />
            </button>
          )}
        />
      </div>

      {loading && <div className={css.gitPlaceholder}>{t('loading')}</div>}
      {!loading && error !== null && <div className={css.gitError}>{error}</div>}
      {!loading && status !== null && !status.isRepo && (
        <div className={css.gitPlaceholder}>{t('notRepo')}</div>
      )}
      {operation !== null && (
        <div className={css.gitOperation}>
          <span>{t('operationConflict', { operation: t(operation === 'merge' ? 'mergeBranch' : 'rebaseBranch') })}</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { void finishOperation(true) }}>{t('operationAbort')}</Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => { void finishOperation(false) }}>{t('operationContinue')}</Button>
        </div>
      )}

      {status !== null && status.isRepo && (
        <>
          <div className={`${css.gitSection} ${css.gitSectionFlat}`}>
            <div className={css.gitSectionHeader}>
              <button type="button" className={css.gitSectionToggle} aria-expanded={expandedSections.changes} aria-controls={`git-changes-${viewId}`} onClick={() => { toggleSection('changes') }}>
                <IconChevronRightOutline14 className={expandedSections.changes ? css.gitSectionChevronExpanded : css.gitSectionChevron} />
                <span>{t('changes')}</span>
                <span className={css.gitSectionCount}>{entries.length}</span>
              </button>
              {entries.length > 0 && <span className={css.gitSectionHint}>{t('tickToStage')}</span>}
            </div>
            {expandedSections.changes && (
              <div id={`git-changes-${viewId}`} className={`${css.gitSectionBody} ${css.gitSectionBodyChanges}`} {...scrollProps('changes')}>
                {entries.length === 0 && (
                  <div className={css.gitClean}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                    <span className={css.gitCleanTitle}>{t('cleanTree')}</span>
                    <span className={css.gitCleanMeta}>{status.ahead > 0 ? t('unpushedReminder', { count: status.ahead }) : t('synced')}</span>
                  </div>
                )}
                {entries.map(renderEntry)}
              </div>
            )}
          </div>

          <div className={css.gitSection}>
            <div className={css.gitSectionHeader}>
              <button type="button" className={css.gitSectionToggle} aria-expanded={expandedSections.stash} aria-controls={`git-stash-entries-${viewId}`} onClick={() => { toggleSection('stash') }}>
                <IconChevronRightOutline14 className={expandedSections.stash ? css.gitSectionChevronExpanded : css.gitSectionChevron} />
                <span>{t('stash')}</span>
                <span className={css.gitSectionCount}>{stashEntries.length}</span>
              </button>
            </div>
            {stashError !== null && <div className={css.gitError}>{stashError}</div>}
            {expandedSections.stash && (
              <div id={`git-stash-entries-${viewId}`} className={css.gitSectionBody} {...scrollProps('stash')}>
                {stashEntries.length === 0 && <div className={css.gitEmpty}>{t('noChanges')}</div>}
                {stashEntries.map(entry => (
                  <div key={entry.ref} className={css.gitRow}>
                    <button
                      type="button"
                      className={css.gitRowMain}
                      title={`${entry.ref}  ${entry.message}`}
                      onClick={(event) => { openStashMenu(event, entry) }}
                      onContextMenu={(event) => { openStashMenu(event, entry) }}
                    >
                      <span className={css.gitLogHash}>{entry.ref}</span>
                      <span className={css.gitName}>{entry.message}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${css.gitSection} ${css.gitSectionFlat}`}>
            <div className={css.gitSectionHeader}>
              <button type="button" className={css.gitSectionToggle} aria-expanded={expandedSections.tag} aria-controls={`git-tag-entries-${viewId}`} onClick={() => { toggleSection('tag') }}>
                <IconChevronRightOutline14 className={expandedSections.tag ? css.gitSectionChevronExpanded : css.gitSectionChevron} />
                <span>{t('tag')}</span>
                <span className={css.gitSectionCount}>{tagEntries.length}</span>
              </button>
            </div>
            {tagError !== null && <div className={css.gitError}>{tagError}</div>}
            {expandedSections.tag && (
              <div id={`git-tag-entries-${viewId}`} className={css.gitSectionBody} {...scrollProps('tag')}>
                {tagEntries.length === 0 && <div className={css.gitEmpty}>{t('noChanges')}</div>}
                {tagEntries.map(entry => (
                  <div key={entry.name} className={css.gitRow}>
                    <button
                      type="button"
                      className={css.gitRowMain}
                      title={`${entry.name}  ${entry.subject}`}
                      onClick={(event) => { openTagMenu(event, entry) }}
                      onContextMenu={(event) => { openTagMenu(event, entry) }}
                    >
                      <span className={css.gitLogHash}>{entry.name}</span>
                      <span className={css.gitName}>{entry.subject}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${css.gitSection} ${css.gitSectionFlat}`}>
            <div className={css.gitSectionHeader}>
              <button type="button" className={css.gitSectionToggle} aria-expanded={expandedSections.history} aria-controls={`git-history-${viewId}`} onClick={() => { toggleSection('history') }}>
                <IconChevronRightOutline14 className={expandedSections.history ? css.gitSectionChevronExpanded : css.gitSectionChevron} />
                <span>{t('history')}</span>
              </button>
              {historyScrolled && (
                <button type="button" className={`${css.gitLink} ${css.gitBackToTop}`} onClick={backToTop}>{t('backToTop')}</button>
              )}
              {logEntries.length > 0 && <span className={`${css.gitSectionHint} ${historyScrolled ? css.gitSectionHintAfterLink : ''}`}>{t('historyRecent', { count: logEntries.length })}</span>}
            </div>
            {compareFrom !== null && (
              <div className={css.gitCompareBar}>
                <span>{t('comparePick', { hash: compareFrom.hash })}</span>
                <button type="button" className={css.gitLink} onClick={() => { setCompareFrom(null) }}>{t('cancel')}</button>
              </div>
            )}
            {expandedSections.history && (
            <div
              id={`git-history-${viewId}`}
              className={`${css.gitSectionBody} ${css.gitSectionBodyHistory}`}
              data-scroll-key="history"
              onScroll={(event) => {
                const box = event.currentTarget
                memory.scroll.history = box.scrollTop
                setHistoryScrolled(box.scrollTop > box.clientHeight)
                // Infinite scroll: page in the next batch when the bottom is near.
                if (box.scrollTop + box.clientHeight >= box.scrollHeight - LOAD_MORE_THRESHOLD) void loadMoreLog()
              }}
            >
            {logEntries.map((entry, index) => (
              <div
                key={entry.hashFull}
                role="button"
                tabIndex={0}
                className={css.gitLogRow}
                title={`${refNames(entry.refs).join(' ')}\n${entry.author} · ${entry.date}\n${entry.hashFull}`.trimStart()}
                onClick={() => { pickHistoryRow(entry) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    pickHistoryRow(entry)
                  }
                }}
                onContextMenu={(event) => { openHistoryMenu(event, entry) }}
              >
                <GraphCell row={graph.rows[index]!} lanes={graph.lanes} />
                <span className={css.gitLogHash}>{entry.hash}</span>
                <span className={css.gitLogSubject}>{entry.subject}</span>
                {refNames(entry.refs).map(ref => (
                  <span key={ref} className={css.gitLogRef} style={{ color: GRAPH_COLORS[graph.rows[index]!.lane % GRAPH_COLORS.length] }}>{ref}</span>
                ))}
                <span className={css.gitLogMeta}>{relativeTime(entry.date)}</span>
              </div>
            ))}
            {!logEnded && (
              <button
                type="button"
                className={css.gitLogMore}
                disabled={logLoadingMore || busy}
                onClick={() => { void loadMoreLog() }}
              >
                {logLoadingMore ? t('loading') : t('loadMore')}
              </button>
            )}
            </div>
            )}
          </div>

          <div className={css.gitCommit}>
            <textarea
              className={css.gitCommitInput}
              rows={2}
              placeholder={t('commitPlaceholder')}
              value={commitMsg}
              disabled={busy}
              onChange={(event) => { setCommitMsg(event.target.value); setCommitError(null) }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void commit()
              }}
            />
            <div className={css.gitCommitFooter}>
              <span className={css.gitCommitHint}>
                {stagedEntries.length > 0 ? t('commitHint', { count: stagedEntries.length }) : t('commitHintEmpty')}
              </span>
              <button
                type="button"
                className={css.gitCommitButton}
                disabled={busy || commitMsg.trim() === '' || stagedEntries.length === 0}
                onClick={() => { void commit() }}
              >
                {t('commit')}
              </button>
            </div>
          </div>
          {commitError !== null && <div className={css.gitError}>{commitError}</div>}

          {/*
            The one shared file-row context menu, positioned at the right-click
            cursor (portal so the panel's overflow clip cannot crop it).
          */}
          <Menu
            open={fileMenu !== null}
            onClose={() => { setFileMenu(null) }}
            items={[
              { id: 'open', label: t('openEditor'), icon: <IconCodeOutline16 size={14} /> },
              fileMenu?.staged === true
                ? { id: 'stage', label: t('unstage'), icon: <IconTrashOutline16 size={14} /> }
                : { id: 'stage', label: t('stage'), icon: <IconBranchOutline16 size={14} /> },
              ...(fileMenu !== null && !isUntracked(fileMenu.entry)
                ? [{ id: 'discard', label: t('discard'), icon: <IconTrashOutline16 size={14} />, danger: true }]
                : []),
              { type: 'separator', id: 'sep1' },
              { id: 'relative', label: t('copyRelative'), icon: <IconCopyOutline16 size={14} /> },
              { id: 'absolute', label: t('copyAbsolute'), icon: <IconCopyOutline16 size={14} /> },
            ]}
            onSelect={(id) => {
              const target = fileMenu
              if (target === null) return
              setFileMenu(null)
              if (id === 'open') {
                void Promise.resolve().then(() => onOpenFile(target.entry.path)).catch(reason => { setCommitError(reason instanceof Error ? reason.message : String(reason)) })
                return
              }
              if (id === 'stage') {
                void stageEntry(target.entry, target.staged)
                return
              }
              if (id === 'discard') {
                runConfirmed({
                  title: t('discardTitle'),
                  description: t('discardDesc', { path: target.entry.path }),
                  confirmLabel: t('discard'),
                  onConfirm: () => api.gitDiscard(scope, target.entry.path),
                })
                return
              }
              if (id === 'relative') {
                copy(relativeTo(scope.cwd ?? '', target.entry.path))
                return
              }
              if (id === 'absolute') copy(target.entry.path)
            }}
            portal
            align="start"
            getAnchorRect={() => (fileMenu === null ? null : new DOMRect(fileMenu.x, fileMenu.y, 0, 0))}
            anchor={<span />}
          />

          {/* The shared stash-row context menu. */}
          <Menu
            open={stashMenu !== null}
            onClose={() => { setStashMenu(null) }}
            items={[
              { id: 'pop', label: t('stashPop') },
              { id: 'apply', label: t('stashApply') },
              { type: 'separator', id: 'sep3' },
              { id: 'drop', label: t('stashDrop'), icon: <IconTrashOutline16 size={14} />, danger: true },
            ]}
            onSelect={(id) => {
              const target = stashMenu
              if (target === null) return
              setStashMenu(null)
              if (id === 'pop') {
                void runStashAction(() => api.gitStashPop(scope, target.entry.ref))
                return
              }
              if (id === 'apply') {
                void runStashAction(() => api.gitStashApply(scope, target.entry.ref))
                return
              }
              if (id === 'drop') {
                runConfirmed({
                  title: t('stashDropTitle'),
                  description: t('stashDropDesc', { ref: target.entry.ref }),
                  confirmLabel: t('stashDrop'),
                  onConfirm: () => api.gitStashDrop(scope, target.entry.ref),
                }, setStashError)
              }
            }}
            portal
            align="start"
            getAnchorRect={() => (stashMenu === null ? null : new DOMRect(stashMenu.x, stashMenu.y, 0, 0))}
            anchor={<span />}
          />

          {/* The shared tag-row context menu. */}
          <Menu
            open={tagMenu !== null}
            onClose={() => { setTagMenu(null) }}
            items={[
              { id: 'push', label: t('tagPush') },
              { id: 'copy', label: t('tagCopyName'), icon: <IconCopyOutline16 size={14} /> },
              { type: 'separator', id: 'tag-separator' },
              { id: 'delete', label: t('tagDelete'), icon: <IconTrashOutline16 size={14} />, danger: true },
            ]}
            onSelect={(id) => {
              const target = tagMenu
              if (target === null) return
              setTagMenu(null)
              if (id === 'copy') {
                copy(target.entry.name)
                return
              }
              if (id === 'push') {
                runConfirmed({
                  title: t('tagPushTitle'),
                  description: t('tagPushDesc', { name: target.entry.name }),
                  confirmLabel: t('tagPush'),
                  onConfirm: () => api.gitTagPush(scope, target.entry.name),
                }, setTagError)
                return
              }
              if (id === 'delete') {
                runConfirmed({
                  title: t('tagDeleteTitle'),
                  description: t('tagDeleteDesc', { name: target.entry.name }),
                  confirmLabel: t('tagDelete'),
                  onConfirm: () => api.gitTagDelete(scope, target.entry.name),
                }, setTagError)
              }
            }}
            portal
            align="start"
            getAnchorRect={() => (tagMenu === null ? null : new DOMRect(tagMenu.x, tagMenu.y, 0, 0))}
            anchor={<span />}
          />

          {/* The shared history-row context menu. */}
          <Menu
            open={historyMenu !== null}
            onClose={() => { setHistoryMenu(null) }}
            items={(() => {
              const entry = historyMenu?.entry
              const locals = entry === undefined ? [] : localBranchesAt(entry)
              const switchable = locals.filter(name => name !== status?.branch)
              const deletable = switchable
              return [
                { id: 'view', label: t('viewCommitDiff') },
                { type: 'separator', id: 'sep-open' },
                { id: 'checkout', label: t('checkoutBranch'), disabled: switchable.length === 0, submenu: switchable.map(name => ({ id: `checkout:${name}`, label: name })) },
                { id: 'checkoutDetached', label: t('checkoutDetached') },
                { type: 'separator', id: 'sep-branch' },
                { id: 'branchCreate', label: t('branchCreate') },
                { id: 'branchDelete', label: t('branchDelete'), disabled: deletable.length === 0, submenu: deletable.map(name => ({ id: `delete:${name}`, label: name })) },
                { type: 'separator', id: 'sep-tag' },
                { id: 'tag', label: t('tagCreateHere') },
                { type: 'separator', id: 'sep-pick' },
                { id: 'cherryPick', label: t('cherryPickCommit') },
                { id: 'revert', label: t('revertCommit'), danger: true },
                { type: 'separator', id: 'sep-compare' },
                { id: 'compareRemote', label: t('compareRemote'), disabled: (status?.branch ?? 'HEAD') === 'HEAD' },
                { id: 'compareMergeBase', label: t('compareMergeBase') },
                { id: 'compareWith', label: t('compareWith') },
                { type: 'separator', id: 'sep-copy' },
                { id: 'copyFull', label: t('copyFullHash') },
                { id: 'copySubject', label: t('copySubject') },
                { type: 'separator', id: 'sep-chat' },
                { id: 'addToChat', label: t('addToChat') },
                { id: 'explain', label: t('explainCommit') },
              ]
            })()}
            onSelect={(id) => {
              const target = historyMenu
              if (target === null) return
              setHistoryMenu(null)
              const entry = target.entry
              if (id === 'view') openCommitDiff(entry)
              if (id.startsWith('checkout:')) void checkout(id.slice('checkout:'.length))
              if (id === 'checkoutDetached') void checkout(entry.hashFull)
              if (id === 'branchCreate') { setBranchDraftError(null); setBranchDraft({ commit: entry, name: '' }) }
              if (id.startsWith('delete:')) {
                const name = id.slice('delete:'.length)
                runConfirmed({
                  title: t('branchDeleteTitle'),
                  description: t('branchDeleteDesc', { name }),
                  confirmLabel: t('branchDelete'),
                  onConfirm: () => api.gitBranchDelete(scope, name),
                })
              }
              if (id === 'tag') { setTagDraftError(null); setTagDraft({ commit: entry, name: '', message: '' }) }
              if (id === 'cherryPick') {
                runConfirmed({
                  title: t('cherryPickTitle'),
                  description: t('cherryPickDesc', { subject: entry.subject }),
                  confirmLabel: t('cherryPickCommit'),
                  onConfirm: () => api.gitCherryPick(scope, entry.hashFull),
                })
              }
              if (id === 'revert') {
                runConfirmed({
                  title: t('revertTitle'),
                  description: t('revertDesc', { subject: entry.subject }),
                  confirmLabel: t('revertCommit'),
                  onConfirm: () => api.gitRevert(scope, entry.hashFull),
                })
              }
              if (id === 'compareRemote') {
                const remote = `origin/${status?.branch ?? ''}`
                openRangeDiff(remote, entry.hashFull, false, `${remote} ↔ ${entry.hash}`)
              }
              if (id === 'compareMergeBase') openRangeDiff('HEAD', entry.hashFull, true, t('compareMergeBaseTitle', { hash: entry.hash }))
              if (id === 'compareWith') setCompareFrom(entry)
              if (id === 'copyFull') copy(entry.hashFull)
              if (id === 'copySubject') copy(entry.subject)
              if (id === 'addToChat') void sendPrompt(t('addToChatText', { hash: entry.hashFull, subject: entry.subject }))
              if (id === 'explain') void sendPrompt(t('explainCommitText', { hash: entry.hashFull, subject: entry.subject }))
            }}
            portal
            align="start"
            compact
            getAnchorRect={() => (historyMenu === null ? null : new DOMRect(historyMenu.x, historyMenu.y, 0, 0))}
            anchor={<span />}
          />

          {/* Destructive actions land here first: Cancel / Confirm. */}
          <Modal
            open={confirm !== null}
            onClose={() => { setConfirm(null) }}
            title={confirm?.title ?? ''}
            closeLabel={t('cancel')}
            footer={(
              <>
                <Button variant="outline" onClick={() => { setConfirm(null) }}>{t('cancel')}</Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => {
                    const pending = confirm
                    if (pending === null) return
                    setConfirm(null)
                    void pending.onConfirm()
                  }}
                >
                  {confirm?.confirmLabel ?? ''}
                </Button>
              </>
            )}
          >
            <p className={css.gitConfirmDesc}>{confirm?.description}</p>
          </Modal>
        </>
      )}

      <Modal
        open={branchDraft !== null}
        onClose={() => { setBranchDraft(null) }}
        title={t('branchCreateTitle')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setBranchDraft(null) }}>{t('cancel')}</Button>
            <Button variant="primary" disabled={busy || (branchDraft?.name.trim() ?? '') === ''} onClick={() => { void createBranch() }}>
              {t('branchCreateConfirm')}
            </Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>
          {branchDraft !== null && t('branchAtCommit', { hash: branchDraft.commit.hash, subject: branchDraft.commit.subject })}
        </p>
        <Input
          placeholder={t('branchNamePlaceholder')}
          value={branchDraft?.name ?? ''}
          disabled={busy}
          onChange={(event) => { setBranchDraft(draft => draft === null ? draft : { ...draft, name: event.target.value }); setBranchDraftError(null) }}
        />
        {branchDraftError !== null && <div className={css.gitError}>{branchDraftError}</div>}
      </Modal>

      <Modal
        open={tagDraft !== null}
        onClose={() => { setTagDraft(null) }}
        title={t('tagCreateTitle')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setTagDraft(null) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy || (tagDraft?.name.trim() ?? '') === ''}
              onClick={() => { void createTag() }}
            >
              {t('tagCreate')}
            </Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>
          {tagDraft?.commit == null
            ? t('tagAtHead')
            : t('tagAtCommit', { hash: tagDraft.commit.hash, subject: tagDraft.commit.subject })}
        </p>
        <Input
          placeholder={t('tagNamePlaceholder')}
          value={tagDraft?.name ?? ''}
          disabled={busy}
          onChange={(event) => { setTagDraft(draft => draft === null ? draft : { ...draft, name: event.target.value }); setTagDraftError(null) }}
        />
        <Input
          placeholder={t('tagMessagePlaceholder')}
          value={tagDraft?.message ?? ''}
          disabled={busy}
          onChange={(event) => { setTagDraft(draft => draft === null ? draft : { ...draft, message: event.target.value }); setTagDraftError(null) }}
        />
        {tagDraftError !== null && <div className={css.gitError}>{tagDraftError}</div>}
      </Modal>

      <Modal
        open={mergeSource !== null}
        onClose={() => { setMergeSource(null) }}
        title={t('mergeTitle')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setMergeSource(null) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy || mergeSource === null}
              onClick={() => {
                const branch = mergeSource
                if (branch === null) return
                setMergeSource(null)
                void merge(branch)
              }}
            >
              {t('mergeBranch')}
            </Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>{t('mergeDesc', { source: mergeSource ?? '', current: status?.branch ?? '' })}</p>
        <div className={css.gitBranchFlow}>
          <select
            className={css.gitBranchSelect}
            aria-label={t('mergeTitle')}
            value={mergeSource ?? ''}
            onChange={(event) => { setMergeSource(event.target.value) }}
          >
            {branchNames.filter(name => name !== status?.branch).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <span aria-hidden="true">→</span>
          <span title={status?.branch ?? ''}>{status?.branch}</span>
        </div>
      </Modal>

      <Modal
        open={rebaseTarget !== null}
        onClose={() => { setRebaseTarget(null) }}
        title={t('rebaseTitle')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setRebaseTarget(null) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy || rebaseTarget === null}
              onClick={() => {
                const branch = rebaseTarget
                if (branch === null) return
                setRebaseTarget(null)
                void rebase(branch)
              }}
            >
              {t('rebaseBranch')}
            </Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>{t('rebaseDesc', { current: status?.branch ?? '', target: rebaseTarget ?? '' })}</p>
        <div className={css.gitBranchFlow}>
          <span title={status?.branch ?? ''}>{status?.branch}</span>
          <span aria-hidden="true">→</span>
          <select
            className={css.gitBranchSelect}
            aria-label={t('rebaseTitle')}
            value={rebaseTarget ?? ''}
            onChange={(event) => { setRebaseTarget(event.target.value) }}
          >
            {branchNames.filter(name => name !== status?.branch).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <p className={css.gitRebaseWarning}>{t('rebaseWarning')}</p>
      </Modal>

      <Modal
        open={worktreeOpen}
        onClose={() => { setWorktreeOpen(false) }}
        title={t('worktrees')}
        closeLabel={t('close')}
        footer={<Button variant="outline" onClick={() => { setWorktreeOpen(false) }}>{t('close')}</Button>}
      >
        <form
          className={css.gitWorktreeCreate}
          onSubmit={(event) => {
            event.preventDefault()
            void addWorktree()
          }}
        >
          <select
            className={css.gitBranchSelect}
            aria-label={t('worktreeBranch')}
            value={worktreeCreateNew ? '__new__' : worktreeBranch}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value
              setWorktreeCreateNew(value === '__new__')
              if (value !== '__new__') setWorktreeBranch(value)
              setWorktreePath(`${worktreePathPrefix}${(value === '__new__' ? worktreeNewBranch || 'new-branch' : value).replace(/[^\w.-]+/g, '-')}`)
            }}
          >
            <option value="__new__">{t('worktreeCreateBranch')}</option>
            {branchNames
              .filter(name => !worktrees.some(entry => entry.branch === name))
              .map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {worktreeCreateNew && (
            <>
              <Input
                value={worktreeNewBranch}
                aria-label={t('worktreeNewBranch')}
                placeholder={t('worktreeNewBranch')}
                disabled={busy}
                onChange={(event) => {
                  setWorktreeNewBranch(event.target.value)
                  setWorktreePath(`${worktreePathPrefix}${(event.target.value || 'new-branch').replace(/[^\w.-]+/g, '-')}`)
                }}
              />
              <select className={css.gitBranchSelect} aria-label={t('worktreeBase')} value={worktreeBase} disabled={busy} onChange={(event) => { setWorktreeBase(event.target.value) }}>
                {worktreeBase !== '' && !branchNames.includes(worktreeBase) && <option value={worktreeBase}>{worktreeBase}</option>}
                {branchNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </>
          )}
          <Input
            value={worktreePath}
            aria-label={t('worktreePath')}
            placeholder={t('worktreePathPlaceholder')}
            disabled={busy || (worktreeCreateNew ? worktreeNewBranch.trim() === '' : worktreeBranch === '')}
            onChange={(event) => { setWorktreePath(event.target.value) }}
          />
          <Button type="submit" size="sm" variant="primary" disabled={busy || (worktreeCreateNew ? worktreeNewBranch.trim() === '' || worktreeBase === '' : worktreeBranch === '') || worktreePath.trim() === ''}>
            {t('worktreeAdd')}
          </Button>
        </form>
        {!worktreeCreateNew && worktreeBranch === '' && <p className={css.gitWorktreeHint}>{t('worktreeNoBranch')}</p>}
        {worktreeError !== null && <div className={css.gitError}>{worktreeError}</div>}
        <div className={css.gitWorktreeList}>
          {worktrees.map(entry => (
            <div key={entry.path} className={css.gitWorktreeRow}>
              <button
                type="button"
                className={css.gitWorktreeMain}
                disabled={busy || entry.prunable}
                title={t('worktreeOpenSession')}
                onClick={() => { void openWorktree(entry.path) }}
              >
                <span className={css.gitWorktreeLine}>
                  <span className={css.gitLogRef}>{entry.branch ?? t('worktreeDetached')}</span>
                  {entry.current && <span className={css.gitWorktreeCurrent}>{t('worktreeCurrent')}</span>}
                  {entry.locked && <span className={css.gitWorktreeCurrent}>{t('worktreeLocked')}</span>}
                </span>
                <span className={css.gitWorktreePath}>{entry.path}</span>
              </button>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('worktreeMerge')}
                title={t('worktreeMerge')}
                disabled={busy || entry.current || entry.branch === undefined || operation !== null}
                onClick={() => {
                  setWorktreeOpen(false)
                  setWorktreeMerge(entry)
                  setWorktreeTarget(worktrees.find(candidate => candidate.current)?.path ?? '')
                }}
              >
                <IconBranchOutline16 size={14} />
              </button>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('worktreeRemove')}
                title={entry.current ? t('worktreeCurrentRemove') : t('worktreeRemove')}
                disabled={busy || entry.current || entry.locked}
                onClick={() => {
                  setWorktreeOpen(false)
                  runConfirmed({
                    title: t('worktreeRemoveTitle'),
                    description: t('worktreeRemoveDesc', { path: entry.path }),
                    confirmLabel: t('worktreeRemove'),
                    onConfirm: () => api.gitWorktreeRemove(scope, entry.path),
                  })
                }}
              >
                <IconTrashOutline16 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={worktreeMerge !== null}
        onClose={() => { setWorktreeMerge(null) }}
        title={t('worktreeMergeTitle')}
        closeLabel={t('cancel')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setWorktreeMerge(null) }}>{t('cancel')}</Button>
            <Button variant="outline" disabled={busy || worktreeTarget === ''} onClick={() => { if (worktreeMerge !== null) void mergeWorktree(worktreeMerge, true) }}>{t('worktreeMergeRemove')}</Button>
            <Button variant="primary" disabled={busy || worktreeTarget === ''} onClick={() => { if (worktreeMerge !== null) void mergeWorktree(worktreeMerge, false) }}>{t('worktreeMerge')}</Button>
          </>
        )}
      >
        <p className={css.gitConfirmDesc}>{t('worktreeMergeDesc', { source: worktreeMerge?.branch ?? '', target: worktrees.find(entry => entry.path === worktreeTarget)?.branch ?? '' })}</p>
        <select className={css.gitBranchSelect} aria-label={t('worktreeMergeTitle')} value={worktreeTarget} onChange={(event) => { setWorktreeTarget(event.target.value) }}>
          {worktrees.filter(entry => entry.path !== worktreeMerge?.path && entry.branch !== undefined && !entry.prunable).map(entry => (
            <option key={entry.path} value={entry.path}>{entry.branch}</option>
          ))}
        </select>
      </Modal>
    </div>
  )
}

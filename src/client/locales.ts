/** Git sidebar dictionaries; follow the DSH locale. */
export const zh = {
  git: '源代码管理',
  close: '关闭',
  refresh: '刷新',
  loading: '加载中…',
  notRepo: '当前目录不是 git 仓库',
  noChanges: '没有变更',
  stage: 'Add',
  unstage: '取消 Add',
  stageAll: '全部 Add',
  unstageAll: '全部取消 Add',
  stash: 'Stash',
  stashSave: '存入 Stash',
  stashPop: 'Pop',
  stashApply: 'Apply',
  stashDrop: 'Drop',
  stashDropTitle: '丢弃 Stash',
  stashDropDesc: '将永久丢弃 {ref}（不可恢复）。',
  tag: 'Tag',
  tagNew: '新建 Tag',
  tagCreateTitle: '新建 Tag',
  tagNamePlaceholder: 'Tag 名，例如 v1.2.0',
  tagMessagePlaceholder: '描述（选填，填写后创建附注 Tag）',
  tagAtCommit: '目标提交：{hash} {subject}',
  tagAtHead: '打在当前分支的最新提交上。',
  tagCreate: '创建',
  tagCreateHere: '在此提交创建 Tag',
  tagCopyName: '复制 Tag 名',
  tagPush: '推送到远端',
  tagPushTitle: '推送 Tag 到远端',
  tagPushDesc: '将把 {name} 推送到远端，其他人随后就能看到它。',
  tagDelete: '删除',
  tagDeleteTitle: '删除 Tag',
  tagDeleteDesc: '将删除本地 Tag {name}（远端上的同名 Tag 不受影响）。',
  commitPlaceholder: '提交信息 (Ctrl+Enter)',
  commit: '提交',
  fetch: 'Fetch',
  fetchAll: 'Fetch All',
  pushBranch: '推送当前分支',
  fetchError: '拉取远端失败',
  pushError: '推送失败',
  uncommittedReminder: '有 {count} 个未提交更改',
  unpushedReminder: '有 {count} 个已提交更改尚未推送',
  checkoutError: '切换分支失败',
  branchActions: '分支操作',
  mergeBranch: '合并分支',
  mergeTitle: '合并分支',
  mergeDesc: '将「{source}」合并到当前分支「{current}」。',
  mergeError: '合并分支失败',
  rebaseBranch: '变基分支',
  rebaseTitle: '变基分支',
  rebaseDesc: '将当前分支「{current}」变基到「{target}」之上。',
  rebaseWarning: '变基会重写当前分支的提交历史；已推送的分支请谨慎操作。',
  rebaseError: '变基分支失败',
  worktrees: 'Git Worktree',
  worktreeBranch: '分支',
  worktreePath: 'Worktree 路径',
  worktreePathPlaceholder: '输入新 Worktree 路径',
  worktreeAdd: '新建',
  worktreeCreateBranch: '+ 新建分支',
  worktreeNewBranch: '新分支名称',
  worktreeBase: '基准分支',
  worktreeNoBranch: '没有可用分支：已签出的分支不能再创建 Worktree。',
  worktreeOpenSession: '打开此 Worktree 的 DSH 会话',
  worktreeCurrent: '当前',
  worktreeLocked: '已锁定',
  worktreeDetached: '分离 HEAD',
  worktreeRemove: '删除 Worktree',
  worktreeCurrentRemove: '不能删除当前 Worktree',
  worktreeRemoveTitle: '删除 Worktree',
  worktreeRemoveDesc: '将删除 Worktree 目录「{path}」。如果存在未提交更改，Git 会拒绝操作。',
  worktreeSessionUnsupported: '当前 DSH 版本不支持从 Worktree 创建会话',
  worktreeMerge: '合并分支',
  worktreeMergeTitle: '合并 Worktree',
  worktreeMergeDesc: '将「{source}」合并到目标分支「{target}」。',
  worktreeMergeRemove: '合并并删除',
  operationConflict: '{operation}尚未完成，解决冲突后继续，或中止操作。',
  operationContinue: '继续',
  operationAbort: '中止',
  history: '历史',
  staged: '已 Add',
  changes: '变更',
  cleanTree: '工作区没有变更',
  sync: '同步',
  syncTitle: '拉取远端，并推送当前分支的新提交',
  syncError: '同步失败',
  commitHint: '将提交 {count} 个文件',
  commitHintEmpty: '没有可提交的变更（先勾选文件）',
  unstaged: '未 Add',
  untracked: '未跟踪',
  cancel: '取消',
  diffEmpty: '没有文本差异',
  diffLoadError: '加载差异失败',
  diffBinary: '二进制',
  diffAdded: '新增',
  diffDeleted: '删除',
  diffRenamed: '重命名',
  diffExpand: '展开其余 {count} 行',
  diffCollapse: '收起',
  discard: '放弃更改',
  discardTitle: '放弃更改',
  discardDesc: '将丢弃「{path}」的工作区修改（不可恢复）。',
  discardAll: '放弃所有更改',
  discardAllTitle: '放弃所有更改',
  discardAllDesc: '将恢复 {count} 个已跟踪文件并取消 Add（不可恢复）。未跟踪文件将保留。',
  viewCommitDiff: '查看提交差异',
  copyShortHash: '复制短哈希',
  copyFullHash: '复制完整哈希',
  copySubject: '复制提交信息',
  revertCommit: '还原此提交',
  revertTitle: '还原此提交',
  revertDesc: '将在当前分支创建一个反转「{subject}」的新提交。',
  cherryPickCommit: '捡取此提交',
  cherryPickTitle: '捡取此提交',
  cherryPickDesc: '将「{subject}」的更改应用到当前分支。',
  timeJustNow: '刚刚',
  timeMinutesAgo: '{n} 分钟前',
  timeHoursAgo: '{n} 小时前',
  timeYesterday: '昨天',
  loadMore: '加载更多',
  historyLoadError: '加载更多历史失败',
  openEditor: '打开编辑器',
  copyRelative: '复制相对地址',
  copyAbsolute: '复制绝对地址',
}
export const en = {
  git: 'Source Control',
  close: 'Close',
  refresh: 'Refresh',
  loading: 'Loading…',
  notRepo: 'This directory is not a git repository',
  noChanges: 'No changes',
  stage: 'Stage',
  unstage: 'Unstage',
  stageAll: 'Stage all',
  unstageAll: 'Unstage all',
  stash: 'Stash',
  stashSave: 'Stash all',
  stashPop: 'Pop',
  stashApply: 'Apply',
  stashDrop: 'Drop',
  stashDropTitle: 'Drop stash',
  stashDropDesc: 'Permanently drop {ref} (not recoverable).',
  tag: 'Tag',
  tagNew: 'New tag',
  tagCreateTitle: 'New tag',
  tagNamePlaceholder: 'Tag name, e.g. v1.2.0',
  tagMessagePlaceholder: 'Message (optional; creates an annotated tag)',
  tagAtCommit: 'Target commit: {hash} {subject}',
  tagAtHead: 'Tags the latest commit on the current branch.',
  tagCreate: 'Create',
  tagCreateHere: 'Create tag here',
  tagCopyName: 'Copy tag name',
  tagPush: 'Push to remote',
  tagPushTitle: 'Push tag to remote',
  tagPushDesc: 'Push {name} to the remote, where everyone else will see it.',
  tagDelete: 'Delete',
  tagDeleteTitle: 'Delete tag',
  tagDeleteDesc: 'Delete the local tag {name} (a remote tag of the same name is untouched).',
  commitPlaceholder: 'Commit message (Ctrl+Enter)',
  commit: 'Commit',
  fetch: 'Fetch',
  fetchAll: 'Fetch All',
  pushBranch: 'Push current branch',
  fetchError: 'Fetch failed',
  pushError: 'Push failed',
  uncommittedReminder: '{count} uncommitted change(s)',
  unpushedReminder: '{count} committed change(s) not pushed',
  checkoutError: 'Branch switch failed',
  branchActions: 'Branch actions',
  mergeBranch: 'Merge branch',
  mergeTitle: 'Merge branch',
  mergeDesc: 'Merge "{source}" into the current branch "{current}".',
  mergeError: 'Branch merge failed',
  rebaseBranch: 'Rebase branch',
  rebaseTitle: 'Rebase branch',
  rebaseDesc: 'Rebase the current branch "{current}" onto "{target}".',
  rebaseWarning: 'Rebase rewrites the current branch history; use caution if the branch has been pushed.',
  rebaseError: 'Branch rebase failed',
  worktrees: 'Git Worktrees',
  worktreeBranch: 'Branch',
  worktreePath: 'Worktree path',
  worktreePathPlaceholder: 'Enter a new Worktree path',
  worktreeAdd: 'Create',
  worktreeCreateBranch: '+ Create new branch',
  worktreeNewBranch: 'New branch name',
  worktreeBase: 'Base branch',
  worktreeNoBranch: 'No branches are available; a checked-out branch cannot be used by another Worktree.',
  worktreeOpenSession: 'Open the DSH session for this Worktree',
  worktreeCurrent: 'Current',
  worktreeLocked: 'Locked',
  worktreeDetached: 'Detached HEAD',
  worktreeRemove: 'Remove Worktree',
  worktreeCurrentRemove: 'The current Worktree cannot be removed',
  worktreeRemoveTitle: 'Remove Worktree',
  worktreeRemoveDesc: 'Remove the Worktree directory "{path}". Git refuses when it contains uncommitted changes.',
  worktreeSessionUnsupported: 'This DSH version cannot create a session from a Worktree',
  worktreeMerge: 'Merge branch',
  worktreeMergeTitle: 'Merge Worktree',
  worktreeMergeDesc: 'Merge "{source}" into the target branch "{target}".',
  worktreeMergeRemove: 'Merge and remove',
  operationConflict: '{operation} is incomplete. Resolve conflicts and continue, or abort the operation.',
  operationContinue: 'Continue',
  operationAbort: 'Abort',
  history: 'History',
  staged: 'Staged',
  changes: 'Changes',
  cleanTree: 'Working tree is clean',
  sync: 'Sync',
  syncTitle: 'Fetch, then push the current branch',
  syncError: 'Sync failed',
  commitHint: 'Will commit {count} file(s)',
  commitHintEmpty: 'Nothing staged to commit (tick files first)',
  unstaged: 'Unstaged',
  untracked: 'Untracked',
  cancel: 'Cancel',
  diffEmpty: 'No text changes',
  diffLoadError: 'Failed to load diff',
  diffBinary: 'Binary',
  diffAdded: 'Added',
  diffDeleted: 'Deleted',
  diffRenamed: 'Renamed',
  diffExpand: 'Expand {count} more rows',
  diffCollapse: 'Collapse',
  discard: 'Discard changes',
  discardTitle: 'Discard changes',
  discardDesc: 'This discards the worktree changes of "{path}" (not recoverable).',
  discardAll: 'Discard all changes',
  discardAllTitle: 'Discard all changes',
  discardAllDesc: 'Restore {count} tracked files to HEAD and unstage them (not recoverable). Untracked files will be kept.',
  viewCommitDiff: 'View commit diff',
  copyShortHash: 'Copy short hash',
  copyFullHash: 'Copy full hash',
  copySubject: 'Copy subject',
  revertCommit: 'Revert commit',
  revertTitle: 'Revert commit',
  revertDesc: 'Create a new commit on the current branch that reverts "{subject}".',
  cherryPickCommit: 'Cherry-pick commit',
  cherryPickTitle: 'Cherry-pick commit',
  cherryPickDesc: 'Apply the changes of "{subject}" to the current branch.',
  timeJustNow: 'just now',
  timeMinutesAgo: '{n} min ago',
  timeHoursAgo: '{n} h ago',
  timeYesterday: 'yesterday',
  loadMore: 'Load more',
  historyLoadError: 'Failed to load more history',
  openEditor: 'Open editor',
  copyRelative: 'Copy relative path',
  copyAbsolute: 'Copy absolute path',
}
export const LOCALE_NS = 'gitSidebar'

/** The DSH locale service attached by the client apply (absent → browser detection). */
let localeService: { getSnapshot(): { active: string } } | undefined

/**
 * Attach (or detach, with undefined) the DSH locale service. The sidebar
 * mounts its own React root outside the slot system's locale seat, so the
 * service rides this module-level holder: components keep calling the plain
 * `t()` function, and the Sidebar root's locale subscription re-renders the
 * whole tree on switches.
 */
export function attachLocale(service: { getSnapshot(): { active: string } } | undefined): void {
  localeService = service
}

/**
 * The active locale id ('zh' | 'en'): the DSH locale service's snapshot when
 * attached, else the browser language.
 */
function activeLocale(): string {
  return localeService?.getSnapshot().active
    ?? (typeof navigator !== 'undefined' ? navigator.language : '')
    ?? 'en'
}

/** Translate a copy key in the active locale (zh → zh, else en). */
export type CopyKey = keyof typeof zh

/** Translate a copy key; `{name}` placeholders interpolate from `params`. */
export function t(key: CopyKey, params?: Record<string, string | number>): string {
  const dict = activeLocale().toLowerCase().startsWith('zh') ? zh : en
  let text = dict[key]
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

/** Whether the active locale is Chinese (used for selectors). */
export function isZh(): boolean {
  return activeLocale().toLowerCase().startsWith('zh')
}

/** Format an ISO 8601 author date relative to now (刚刚 / N 分钟前 / N 小时前 / 昨天 / date). */
export function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 60) return t('timeJustNow')
  if (seconds < 3600) return t('timeMinutesAgo', { n: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('timeHoursAgo', { n: Math.floor(seconds / 3600) })
  if (seconds < 172800) return t('timeYesterday')
  const date = new Date(then)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { gitSidebar: CopyKey }
}

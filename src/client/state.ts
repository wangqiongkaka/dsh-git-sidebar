/** What a diff tab shows: a worktree/index change of one path, or one commit's full patch. */
export type SidebarDiffRef =
  | { kind: 'worktree'; path: string; staged: boolean; untracked?: boolean }
  | { kind: 'commit'; hash: string; hashFull: string; subject: string }
  /** `git diff from to` (or merge-base(from, to)..to); `title` is the tab label. */
  | { kind: 'range'; from: string; to: string; mergeBase: boolean; title: string }

/** A diff-open request produced by the Git view. */
export interface SidebarTab {
  id: string
  type: string
  title: string
  diff?: SidebarDiffRef
}

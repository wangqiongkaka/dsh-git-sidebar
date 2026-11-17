export type GitOperation = 'merge' | 'rebase';
/** Subject of a throwaway WIP commit; `wipUndo` only resets a HEAD with exactly this subject. */
export declare const WIP_SUBJECT = "WIP";
/** A parsed `git status --porcelain=v1 -z` entry. */
export interface GitStatusEntry {
    path: string;
    /** Two-letter index/worktree status (X Y), e.g. 'M ', ' M', 'A ', '??'. */
    xy: string;
}
/** The source-control panel snapshot. */
export interface GitStatusResult {
    isRepo: boolean;
    branch?: string;
    ahead: number;
    behind: number;
    entries: GitStatusEntry[];
}
/** One `git log` row. */
export interface GitLogEntry {
    /** Short hash (7+ chars, display). */
    hash: string;
    /** Full 40-char hash (advanced operations: revert / cherry-pick). */
    hashFull: string;
    subject: string;
    author: string;
    /** ISO 8601 author date (`%ai`), e.g. `2024-01-01 10:00:00 +0800`. */
    date: string;
    /** Ref decorations (`%D` with --decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
    refs: string;
    /** Full parent hashes (`%P`), first parent first; [] for a root commit. */
    parents: string[];
}
/** One linked checkout from `git worktree list --porcelain -z`. */
export interface GitWorktree {
    path: string;
    head: string;
    branch?: string;
    current: boolean;
    locked: boolean;
    prunable: boolean;
}
/** One `git stash list` row. */
export interface GitStashEntry {
    /** Stack ref, e.g. 'stash@{0}'. */
    ref: string;
    /** Subject line, e.g. 'WIP on main: 1a2b3c4 subject'. */
    message: string;
}
/** One branch row of the branch manager (local, or remote as `origin/name`). */
export interface GitBranchEntry {
    name: string;
    current: boolean;
    /** Reachable from HEAD, i.e. safe to delete. */
    merged: boolean;
    /** Configured upstream (`origin/main`); absent when the branch tracks nothing. */
    upstream?: string;
    /** Upstream configured but deleted on the remote (`[gone]`). */
    gone: boolean;
    ahead: number;
    behind: number;
    /** Last commit date (`%(committerdate:short)`, e.g. 2024-01-01). */
    date: string;
    subject: string;
}
/** One failed branch deletion inside a batch. */
export interface GitBranchFailure {
    name: string;
    message: string;
}
/** Branch manager snapshot. */
export interface GitBranchOverview {
    current: string;
    /** Preferred remote name; absent when the repository has no remote. */
    remote?: string;
    local: GitBranchEntry[];
    remotes: GitBranchEntry[];
}
export interface GitTagEntry {
    /** Tag name, e.g. 'v1.2.0'. */
    name: string;
    /** Annotation subject for an annotated tag; the tagged commit's subject for a lightweight one. */
    subject: string;
    /** Whether this exact tag object exists on the preferred remote. */
    remoteState: 'synced' | 'local' | 'unknown';
}
/** One git failure (stderr text as the message). */
export declare class GitCommandError extends Error {
    readonly code: string;
    readonly command: string;
    constructor(message: string, code: string | undefined, command: string);
}
/** Parse porcelain v1 -z output into entries (rename/copy pairs collapse to one row). */
export declare function parsePorcelainZ(output: string): GitStatusEntry[];
/** Parse `git log --pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D%x1f%P` rows. */
export declare function parseLogLines(output: string): GitLogEntry[];
/** Parse NUL-framed worktree porcelain without depending on paths being newline-free. */
export declare function parseWorktreePorcelainZ(output: string): GitWorktree[];
/** Whether the directory is inside a git work tree (exit-0 `git rev-parse`). */
export declare function isGitRepo(cwd: string): Promise<boolean>;
/** The repository top level containing `cwd` (`git rev-parse --show-toplevel`). */
export declare function repoRoot(cwd: string): Promise<string>;
/** The current branch name (`git rev-parse --abbrev-ref HEAD`; 'HEAD' when detached). */
export declare function currentBranch(cwd: string): Promise<string>;
/** Working-tree status (untracked included). */
export declare function status(cwd: string): Promise<GitStatusResult>;
/** Fetch the current remote, or every configured remote. */
export declare function fetchRemote(cwd: string, all?: boolean): Promise<void>;
/** Push the current branch to its configured upstream. */
export declare function push(cwd: string): Promise<void>;
/** Diff text of the worktree (unstaged) or the index (staged). */
export declare function diff(cwd: string, path: string | undefined, staged: boolean): Promise<string>;
/** Stage paths (all when path is undefined). */
export declare function stage(cwd: string, path: string | undefined): Promise<void>;
/** Unstage paths (all when path is undefined). */
export declare function unstage(cwd: string, path: string | undefined): Promise<void>;
/**
 * Push every change onto the stash stack. Untracked files are included so the
 * panel's three change groups all clear together — leaving them behind makes
 * the button look like it did nothing.
 */
export declare function stash(cwd: string): Promise<void>;
/** The stash stack, newest (stash@{0}) first; [] when empty. */
export declare function stashList(cwd: string): Promise<GitStashEntry[]>;
/** Restore one stash entry and remove it from the stack. */
export declare function stashPop(cwd: string, ref: string): Promise<void>;
/** Restore one stash entry, keeping it on the stack. */
export declare function stashApply(cwd: string, ref: string): Promise<void>;
/** Discard one stash entry (not recoverable). */
export declare function stashDrop(cwd: string, ref: string): Promise<void>;
/** Commit the staged changes with a message (global identity untouched). */
export declare function commit(cwd: string, message: string): Promise<void>;
/** Stage everything (untracked included) and commit it as a throwaway "WIP" commit. */
export declare function wipCommit(cwd: string): Promise<void>;
/**
 * Drop the WIP commit at HEAD and put its changes back into the working tree
 * (mixed reset, so they show up unstaged like before the WIP commit). Refuses
 * when HEAD is not a WIP commit so a real commit can never be reset by accident.
 */
export declare function wipUndo(cwd: string): Promise<void>;
/**
 * Move the branch back to its upstream (`git reset @{upstream}`, mixed): every
 * unpushed commit is unwound into the working tree, no file content is lost.
 * Refuses when the branch is behind so that fetched remote commits can never be
 * pulled in through a reset. Needs a configured upstream.
 */
export declare function resetToUpstream(cwd: string): Promise<void>;
/** Local branch names by latest commit time (newest first). */
export declare function branches(cwd: string): Promise<{
    current: string;
    names: string[];
}>;
/** Switch to an existing branch. */
export declare function checkout(cwd: string, branch: string): Promise<void>;
/** Create a branch at a commit without switching to it. */
export declare function branchCreate(cwd: string, name: string, commit: string): Promise<void>;
/**
 * Delete local branches (`-d`; `force` switches to `-D`, which also drops
 * unmerged commits). One branch per call so a batch reports exactly which
 * names failed instead of stopping at the first one.
 */
export declare function branchDelete(cwd: string, names: string[], force?: boolean): Promise<GitBranchFailure[]>;
/**
 * Delete branches on their remote (`git push <remote> --delete <branch>`).
 * Each ref carries its remote as the first path segment, the way the panel
 * lists it (`origin/feature`), so no remote has to be passed alongside.
 * ponytail: one push per branch; batch them into a single push if deleting
 * dozens at a time ever gets slow.
 */
export declare function branchDeleteRemote(cwd: string, refs: string[]): Promise<GitBranchFailure[]>;
/** Drop remote-tracking refs whose branch no longer exists on the remote. */
export declare function branchPrune(cwd: string): Promise<void>;
/**
 * Local and remote branches for the branch manager: what each branch tracks,
 * whether its upstream is gone, and whether it is already merged into HEAD —
 * the three things a cleanup decision needs. `for-each-ref` has no `-z`, but
 * no field here can contain a newline.
 */
export declare function branchOverview(cwd: string): Promise<GitBranchOverview>;
/** Parse the `branchOverview` for-each-ref rows (exported for the unit test). */
export declare function parseBranchRows(raw: string, merged: Set<string>, current: string): GitBranchEntry[];
/**
 * Patch between two revisions; with `mergeBase` the left side becomes
 * `merge-base(from, to)` (what `to` adds since the branches diverged).
 */
export declare function rangeDiff(cwd: string, from: string, to: string, mergeBase?: boolean): Promise<string>;
/** Merge an existing branch into the current branch without opening an editor. */
export declare function merge(cwd: string, branch: string): Promise<void>;
/** Replay the current branch's commits on top of an existing branch. */
export declare function rebase(cwd: string, branch: string): Promise<void>;
/** Fast-forward the branch to its upstream (`merge --ff-only`); a dirty working tree is fine as long as it does not touch the incoming files. */
export declare function fastForward(cwd: string): Promise<void>;
/** Linked checkouts for this repository, with the caller's checkout marked. */
export declare function worktrees(cwd: string): Promise<GitWorktree[]>;
/** The main checkout's canonical path inside a linked checkout; undefined for the main checkout or outside a repository. */
export declare function linkedWorktreeMain(cwd: string): Promise<string | undefined>;
/** Add a linked checkout for an existing branch. */
/** Returns the canonical absolute path, matching how DSH stores workspace and session cwd. */
export declare function addWorktree(cwd: string, path: string, branch: string, base?: string): Promise<string>;
export declare function worktreePathPrefix(cwd: string): Promise<string>;
/** Merge only inside a registered Worktree of the same repository. */
export declare function mergeWorktree(cwd: string, targetPath: string, sourceBranch: string): Promise<void>;
/** Remove a clean linked checkout; git refuses dirty/current/locked trees. */
/** Returns the canonical path it had, so the caller can drop the DSH Workspace registered for it. */
export declare function removeWorktree(cwd: string, path: string): Promise<string>;
/** In-progress history operation for conflict recovery controls. */
export declare function operation(cwd: string): Promise<GitOperation | null>;
export declare function continueOperation(cwd: string, kind: GitOperation): Promise<void>;
export declare function abortOperation(cwd: string, kind: GitOperation): Promise<void>;
/**
 * Recent commit history across every branch (newest first, date order so the
 * client graph stays consistent while paging), lazily pageable via skip/count.
 */
export declare function log(cwd: string, count?: number, skip?: number): Promise<GitLogEntry[]>;
/**
 * Content of a file at a revision (`git show <rev>:<path>`), or null when the
 * revision has no such path (a new/untracked file has no HEAD side).
 */
export declare function show(cwd: string, rev: string, path: string): Promise<string | null>;
/** Full patch text of one commit (`git show` with the commit header suppressed).
 *  Merge commits show their diff against the first parent (`-m --first-parent`
 *  is a no-op for regular commits), so a history click always has content. */
export declare function commitDiff(cwd: string, hash: string): Promise<string>;
/**
 * Discard one path's worktree changes. A path HEAD carries is restored from
 * the index (`git checkout -- <path>`, which leaves the index untouched). A
 * path HEAD does not carry has no baseline to restore: it is a file the change
 * being discarded created, so discarding it removes the file. `git checkout`
 * is wrong there — the index holds the addition, so it would rewrite the file
 * from the index and report success without changing anything.
 */
export declare function discard(cwd: string, path: string): Promise<void>;
/**
 * Discard index/worktree changes and remove untracked files and directories.
 * Ignored files and nested repositories are not cleaned.
 */
export declare function discardAll(cwd: string): Promise<void>;
/** Revert one commit onto the current branch with an auto-generated message. */
export declare function revert(cwd: string, hash: string): Promise<void>;
/** Cherry-pick one commit onto the current branch. */
export declare function cherryPick(cwd: string, hash: string): Promise<void>;
/**
 * Every tag, newest-created first. `for-each-ref` has no `-z`, so the rows are
 * newline-separated — safe here because neither a ref name nor
 * `%(contents:subject)` can contain a newline. A lightweight tag has no
 * annotation, so git falls back to the tagged commit's subject.
 */
export declare function tags(cwd: string): Promise<GitTagEntry[]>;
/** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
export declare function createTag(cwd: string, name: string, message?: string, commit?: string): Promise<void>;
/** Delete a local tag (the remote copy, if any, is untouched). */
export declare function deleteTag(cwd: string, name: string): Promise<void>;
export declare function pushTag(cwd: string, name: string): Promise<void>;

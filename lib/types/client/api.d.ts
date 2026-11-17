/** Session-scoped Git API client. */
/** One wire failure. */
export declare class SidebarApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Git status entry (host git shape). */
export interface GitStatusEntry {
    path: string;
    xy: string;
}
/** Git status snapshot. */
export interface GitStatusResult {
    isRepo: boolean;
    branch?: string;
    ahead: number;
    behind: number;
    entries: GitStatusEntry[];
}
/** One stash stack row (host git shape). */
export interface GitStashEntry {
    /** Stack ref, e.g. 'stash@{0}'. */
    ref: string;
    /** Subject line, e.g. 'WIP on main: 1a2b3c4 subject'. */
    message: string;
}
/** One tag row (host git shape). */
export interface GitTagEntry {
    /** Tag name, e.g. 'v1.2.0'. */
    name: string;
    /** Annotation subject for an annotated tag; the tagged commit's subject for a lightweight one. */
    subject: string;
    remoteState: 'synced' | 'local' | 'unknown';
}
/** One branch row of the branch manager (local, or remote as `origin/name`). */
export interface GitBranchEntry {
    name: string;
    current: boolean;
    /** Reachable from HEAD, i.e. safe to delete. */
    merged: boolean;
    /** Configured upstream (`origin/main`); absent when the branch tracks nothing. */
    upstream?: string;
    /** Upstream configured but deleted on the remote. */
    gone: boolean;
    ahead: number;
    behind: number;
    /** Last commit date, e.g. 2024-01-01. */
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
/** One git log row. */
export interface GitLogEntry {
    /** Short hash (7+ chars, display). */
    hash: string;
    /** Full 40-char hash (advanced operations). */
    hashFull: string;
    subject: string;
    author: string;
    /** ISO 8601 author date (`%ai`). */
    date: string;
    /** Ref decorations (--decorate=short), e.g. `HEAD -> main, origin/main`; '' when none. */
    refs: string;
    /** Full parent hashes, first parent first; [] for a root commit. */
    parents: string[];
}
export interface GitWorktree {
    path: string;
    head: string;
    branch?: string;
    current: boolean;
    locked: boolean;
    prunable: boolean;
}
export type GitOperation = 'merge' | 'rebase';
/** Text read result. */
export interface FsTextResult {
    kind: 'text';
    content: string;
    truncated: boolean;
}
/** Binary read result (no content; images load through the media route).
 *  `head` carries the first bytes (base64) for viewer detect sniffing. */
export interface FsBinaryResult {
    kind: 'binary';
    size: number;
    truncated: boolean;
    head: string;
}
/** One request's session scope: the conversation id plus its cwd when known. */
export interface SessionScope {
    sessionId: string;
    /** The session's working directory from the client list summary (optional). */
    cwd?: string;
}
export declare const api: {
    gitPath: (scope: SessionScope, path: string) => Promise<{
        path: string;
    }>;
    fsRead: (scope: SessionScope, path: string, signal?: AbortSignal) => Promise<FsTextResult | FsBinaryResult>;
    gitStatus: (scope: SessionScope, signal?: AbortSignal) => Promise<GitStatusResult>;
    gitDiff: (scope: SessionScope, path: string | undefined, staged: boolean, signal?: AbortSignal) => Promise<{
        diff: string;
    }>;
    gitStage: (scope: SessionScope, path?: string) => Promise<{
        ok: true;
    }>;
    gitUnstage: (scope: SessionScope, path?: string) => Promise<{
        ok: true;
    }>;
    gitStash: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    gitStashList: (scope: SessionScope, signal?: AbortSignal) => Promise<{
        entries: GitStashEntry[];
    }>;
    gitStashPop: (scope: SessionScope, ref: string) => Promise<{
        ok: true;
    }>;
    gitStashApply: (scope: SessionScope, ref: string) => Promise<{
        ok: true;
    }>;
    gitStashDrop: (scope: SessionScope, ref: string) => Promise<{
        ok: true;
    }>;
    gitTags: (scope: SessionScope, signal?: AbortSignal) => Promise<{
        entries: GitTagEntry[];
    }>;
    /** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
    gitTagCreate: (scope: SessionScope, name: string, message?: string, commit?: string) => Promise<{
        ok: true;
    }>;
    gitTagDelete: (scope: SessionScope, name: string) => Promise<{
        ok: true;
    }>;
    gitTagPush: (scope: SessionScope, name: string) => Promise<{
        ok: true;
    }>;
    gitCommit: (scope: SessionScope, message: string) => Promise<{
        ok: true;
    }>;
    /** Stage everything and commit it as a "WIP" commit. */
    gitWipCommit: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    /** Reset the WIP commit at HEAD back into the working tree (rejected when HEAD is not a WIP commit). */
    /** Fast-forward the current branch to its upstream (only when there are no local commits). */
    gitFastForward: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    /** Unwind every unpushed commit into the working tree (`git reset @{upstream}`). */
    gitResetToUpstream: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    gitWipUndo: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    gitFetch: (scope: SessionScope, all?: boolean) => Promise<{
        ok: true;
    }>;
    gitPush: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    gitBranch: (scope: SessionScope, signal?: AbortSignal) => Promise<{
        current: string;
        names: string[];
    }>;
    gitCheckout: (scope: SessionScope, branch: string) => Promise<{
        ok: true;
    }>;
    /** Create a branch at a commit (no switch). */
    gitBranchCreate: (scope: SessionScope, name: string, commit: string) => Promise<{
        ok: true;
    }>;
    /** Local and remote branches with their merged/upstream state. */
    gitBranchList: (scope: SessionScope, signal?: AbortSignal) => Promise<GitBranchOverview>;
    /** Delete branches in one batch; `remote` deletes them on their remote instead.
     *  Never throws for a single bad branch — the failures come back per name. */
    gitBranchDelete: (scope: SessionScope, names: string[], options?: {
        remote?: boolean;
        force?: boolean;
    }) => Promise<{
        failed: GitBranchFailure[];
    }>;
    /** Drop remote-tracking refs whose branch is gone on the remote. */
    gitBranchPrune: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    /** Patch between two revisions (left side = merge-base when `mergeBase`). */
    gitRangeDiff: (scope: SessionScope, from: string, to: string, mergeBase: boolean, signal?: AbortSignal) => Promise<{
        diff: string;
    }>;
    gitMerge: (scope: SessionScope, branch: string) => Promise<{
        ok: true;
    }>;
    gitRebase: (scope: SessionScope, branch: string) => Promise<{
        ok: true;
    }>;
    gitWorktrees: (scope: SessionScope, signal?: AbortSignal) => Promise<{
        entries: GitWorktree[];
        pathPrefix: string;
    }>;
    gitWorktreeLinked: (path: string) => Promise<{
        linked: boolean;
        main?: string;
    }>;
    gitWorktreeAdd: (scope: SessionScope, path: string, branch: string, base?: string) => Promise<{
        path: string;
    }>;
    gitWorktreeMerge: (scope: SessionScope, targetPath: string, sourceBranch: string) => Promise<{
        ok: true;
    }>;
    gitWorktreeRemove: (scope: SessionScope, path: string) => Promise<{
        path: string;
    }>;
    gitOperation: (scope: SessionScope, signal?: AbortSignal) => Promise<{
        operation: GitOperation | null;
    }>;
    gitOperationContinue: (scope: SessionScope, operation: GitOperation) => Promise<{
        ok: true;
    }>;
    gitOperationAbort: (scope: SessionScope, operation: GitOperation) => Promise<{
        ok: true;
    }>;
    /** Recent commit history, lazily pageable (skip/count; defaults 0/30). */
    gitLog: (scope: SessionScope, count?: number, skip?: number, signal?: AbortSignal) => Promise<GitLogEntry[]>;
    /** Full patch text of one commit (diff display for the history rows). */
    gitCommitDiff: (scope: SessionScope, hash: string, signal?: AbortSignal) => Promise<{
        diff: string;
    }>;
    /** Discard the worktree changes of one file (the index is untouched). */
    gitDiscard: (scope: SessionScope, path: string) => Promise<{
        ok: true;
    }>;
    /** Restore tracked files to HEAD and delete added and untracked files. */
    gitDiscardAll: (scope: SessionScope) => Promise<{
        ok: true;
    }>;
    /** Revert one commit onto the current branch. */
    gitRevert: (scope: SessionScope, hash: string) => Promise<{
        ok: true;
    }>;
    /** Cherry-pick one commit onto the current branch. */
    gitCherryPick: (scope: SessionScope, hash: string) => Promise<{
        ok: true;
    }>;
};

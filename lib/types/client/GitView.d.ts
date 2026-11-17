import type { GitStatusEntry, SessionScope } from './api.ts';
import type { SidebarTab } from './state.ts';
/**
 * Split Git's slash-delimited path for the changes list. An untracked
 * directory arrives as `dir/` and keeps its trailing slash in the name.
 */
export declare function listPathParts(path: string): {
    name: string;
    directory: string;
};
/** A tree-view folder; `name` is compacted (`a/b`) when a folder only holds one sub-folder. */
export interface ChangeDirectory {
    path: string;
    name: string;
    directories: ChangeDirectory[];
    files: GitStatusEntry[];
}
/** Nest changed files by directory for the tree view; the returned root has path ''. */
export declare function changeTree(entries: GitStatusEntry[]): ChangeDirectory;
/** `a, b, c 等 N 个` — the name list a confirm dialog shows. */
export declare function previewNames(names: string[]): string;
/** Forget every remembered view (tests isolate cases with it). */
export declare function resetViewMemory(): void;
/** Start a worktree draft on a new branch based on the current branch. */
export declare function defaultWorktreeDraft(currentBranch: string, pathPrefix: string): {
    readonly createNew: true;
    readonly newBranch: "";
    readonly base: string;
    readonly path: `${string}new-branch`;
};
export declare function GitView(props: {
    scope: SessionScope;
    onOpenFile: (path: string) => void | Promise<void>;
    /** Register the Worktree as a DSH Workspace, create a session, and open it. */
    onOpenWorktree: (path: string) => Promise<void>;
    /** Called with the canonical path after a Worktree is removed. */
    onWorktreeRemoved: (path: string) => Promise<void>;
    /** Open a diff modal. */
    onOpenDiff: (tab: SidebarTab) => void;
    /** Queue a text prompt into the session's chat (history row "add to chat" / "explain"). */
    onPrompt: (text: string) => Promise<void>;
}): import("react").JSX.Element;

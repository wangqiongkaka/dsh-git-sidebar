/** Stable, session-scoped addresses keep separate file/commit diffs in separate tabs. */
import type { SidebarDiffRef } from './state.ts';
export declare function diffAddress(sessionId: string, diff: SidebarDiffRef): string;
/** Validate addresses restored from the sidebar or supplied by another plugin. */
export declare function parseDiffAddress(address: string): {
    sessionId: string;
    diff: SidebarDiffRef;
} | undefined;
export declare function diffTitle(diff: SidebarDiffRef): string;

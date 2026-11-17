window.__ModuleLoader__.load({
	id: "dsh-git-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region node_modules/.pnpm/@deepseek-ai+dsh-util-workspace-path@0.2.2-rc.3_@deepseek-ai+cordis@4.0.4/node_modules/@deepseek-ai/dsh-util-workspace-path/lib/index.js
		/**
		* The `dsh-resource://file/…` address grammar: how a file is named across the
		* Sidebar and the resource model, built and parsed without touching a
		* filesystem.
		* @module
		*/
		/** The scheme and type every file address opens with. */
		const FILE_ADDRESS_PREFIX = "dsh-resource://file/";
		/** Component-encode one id or path segment, keeping `:` literal for drive letters. */
		function encodeSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}
		/** Encode a `/`-separated path segment by segment. */
		function encodePath(path) {
			return path.split("/").map(encodeSegment).join("/");
		}
		/**
		* Build the address of a file read through one Session.
		* @param sessionId - the Session whose Host workspace resolves the path.
		* @param path - absolute or workspace-relative path; backslashes are normalized to `/`, and leading `./` prefixes are dropped.
		* @returns the `dsh-resource://file/session/<sessionId>/<path>` address.
		*/
		function sessionFileAddress(sessionId, path) {
			const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
			return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
		}
		//#endregion
		//#region src/client/api.ts
		/** Session-scoped Git API client. */
		/** One wire failure. */
		var SidebarApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		async function call(method, payload, signal) {
			let response;
			try {
				response = await fetch(`/api/git-sidebar/${method}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					signal
				});
			} catch (error) {
				throw new SidebarApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new SidebarApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		/** Fold a scope into a JSON payload ({cwd} only when present). */
		function scopePayload(scope, extra) {
			return {
				sessionId: scope.sessionId,
				...scope.cwd !== void 0 && scope.cwd !== "" ? { cwd: scope.cwd } : {},
				...extra
			};
		}
		const api = {
			gitPath: (scope, path) => call("git.path", scopePayload(scope, { path })),
			fsRead: (scope, path, signal) => call("fs.read", scopePayload(scope, { path }), signal),
			gitStatus: (scope, signal) => call("git.status", scopePayload(scope, {}), signal),
			gitDiff: (scope, path, staged, signal) => call("git.diff", scopePayload(scope, {
				...path !== void 0 ? { path } : {},
				staged
			}), signal),
			gitStage: (scope, path) => call("git.stage", scopePayload(scope, { ...path !== void 0 ? { path } : {} })),
			gitUnstage: (scope, path) => call("git.unstage", scopePayload(scope, { ...path !== void 0 ? { path } : {} })),
			gitStash: (scope) => call("git.stash", scopePayload(scope, {})),
			gitStashList: (scope, signal) => call("git.stash-list", scopePayload(scope, {}), signal),
			gitStashPop: (scope, ref) => call("git.stash-pop", scopePayload(scope, { ref })),
			gitStashApply: (scope, ref) => call("git.stash-apply", scopePayload(scope, { ref })),
			gitStashDrop: (scope, ref) => call("git.stash-drop", scopePayload(scope, { ref })),
			gitTags: (scope, signal) => call("git.tag-list", scopePayload(scope, {}), signal),
			/** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
			gitTagCreate: (scope, name, message, commit) => call("git.tag-create", scopePayload(scope, {
				name,
				...message === void 0 || message === "" ? {} : { message },
				...commit === void 0 ? {} : { commit }
			})),
			gitTagDelete: (scope, name) => call("git.tag-delete", scopePayload(scope, { name })),
			gitTagPush: (scope, name) => call("git.tag-push", scopePayload(scope, { name })),
			gitCommit: (scope, message) => call("git.commit", scopePayload(scope, { message })),
			/** Stage everything and commit it as a "WIP" commit. */
			gitWipCommit: (scope) => call("git.wip-commit", scopePayload(scope, {})),
			/** Reset the WIP commit at HEAD back into the working tree (rejected when HEAD is not a WIP commit). */
			/** Fast-forward the current branch to its upstream (only when there are no local commits). */
			gitFastForward: (scope) => call("git.fast-forward", scopePayload(scope, {})),
			/** Unwind every unpushed commit into the working tree (`git reset @{upstream}`). */
			gitResetToUpstream: (scope) => call("git.reset-to-upstream", scopePayload(scope, {})),
			gitWipUndo: (scope) => call("git.wip-undo", scopePayload(scope, {})),
			gitFetch: (scope, all = false) => call(all ? "git.fetch-all" : "git.fetch", scopePayload(scope, {})),
			gitPush: (scope) => call("git.push", scopePayload(scope, {})),
			gitBranch: (scope, signal) => call("git.branch", scopePayload(scope, {}), signal),
			gitCheckout: (scope, branch) => call("git.checkout", scopePayload(scope, { branch })),
			/** Create a branch at a commit (no switch). */
			gitBranchCreate: (scope, name, commit) => call("git.branch-create", scopePayload(scope, {
				name,
				commit
			})),
			/** Local and remote branches with their merged/upstream state. */
			gitBranchList: (scope, signal) => call("git.branch-list", scopePayload(scope, {}), signal),
			/** Delete branches in one batch; `remote` deletes them on their remote instead.
			*  Never throws for a single bad branch — the failures come back per name. */
			gitBranchDelete: (scope, names, options = {}) => call("git.branch-delete", scopePayload(scope, {
				names,
				...options.remote === true ? { remote: true } : {},
				...options.force === true ? { force: true } : {}
			})),
			/** Drop remote-tracking refs whose branch is gone on the remote. */
			gitBranchPrune: (scope) => call("git.branch-prune", scopePayload(scope, {})),
			/** Patch between two revisions (left side = merge-base when `mergeBase`). */
			gitRangeDiff: (scope, from, to, mergeBase, signal) => call("git.range-diff", scopePayload(scope, {
				from,
				to,
				mergeBase
			}), signal),
			gitMerge: (scope, branch) => call("git.merge", scopePayload(scope, { branch })),
			gitRebase: (scope, branch) => call("git.rebase", scopePayload(scope, { branch })),
			gitWorktrees: (scope, signal) => call("git.worktree-list", scopePayload(scope, {}), signal),
			gitWorktreeLinked: (path) => call("git.worktree-linked", { path }),
			gitWorktreeAdd: (scope, path, branch, base) => call("git.worktree-add", scopePayload(scope, {
				path,
				branch,
				...base === void 0 ? {} : { base }
			})),
			gitWorktreeMerge: (scope, targetPath, sourceBranch) => call("git.worktree-merge", scopePayload(scope, {
				targetPath,
				sourceBranch
			})),
			gitWorktreeRemove: (scope, path) => call("git.worktree-remove", scopePayload(scope, { path })),
			gitOperation: (scope, signal) => call("git.operation", scopePayload(scope, {}), signal),
			gitOperationContinue: (scope, operation) => call("git.operation-continue", scopePayload(scope, { operation })),
			gitOperationAbort: (scope, operation) => call("git.operation-abort", scopePayload(scope, { operation })),
			/** Recent commit history, lazily pageable (skip/count; defaults 0/30). */
			gitLog: (scope, count, skip, signal) => call("git.log", scopePayload(scope, {
				...count !== void 0 ? { count } : {},
				...skip !== void 0 ? { skip } : {}
			}), signal),
			/** Full patch text of one commit (diff display for the history rows). */
			gitCommitDiff: (scope, hash, signal) => call("git.commit-diff", scopePayload(scope, { hash }), signal),
			/** Discard the worktree changes of one file (the index is untouched). */
			gitDiscard: (scope, path) => call("git.discard", scopePayload(scope, { path })),
			/** Restore tracked files to HEAD and delete added and untracked files. */
			gitDiscardAll: (scope) => call("git.discard-all", scopePayload(scope, {})),
			/** Revert one commit onto the current branch. */
			gitRevert: (scope, hash) => call("git.revert", scopePayload(scope, { hash })),
			/** Cherry-pick one commit onto the current branch. */
			gitCherryPick: (scope, hash) => call("git.cherry-pick", scopePayload(scope, { hash }))
		};
		//#endregion
		//#region \0dsh-css:/Users/wangqiongkaka/AIProjects/dsh-plugin/dsh-git-sidebar/src/client/sidebar.module.css.mjs
		const css = ".PHVq-W_iconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.PHVq-W_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.PHVq-W_iconButton:disabled{opacity:.4;cursor:default}.PHVq-W_git{box-sizing:border-box;scrollbar-width:thin;flex-direction:column;flex:1;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden auto}.PHVq-W_gitHeader{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:6px;height:44px;padding:0 8px 0 10px;display:flex}.PHVq-W_gitBranchSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;flex:1;padding:0 8px}.PHVq-W_gitSyncButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);cursor:pointer;border-radius:6px;flex:none;align-items:center;gap:4px;padding:0 8px;display:inline-flex}.PHVq-W_gitSyncButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitSyncButton:disabled{opacity:.4;cursor:default}.PHVq-W_gitSyncBadge{background:var(--dsw-alias-interactive-bg-hover);font:var(--dsw-font-xxxs-strong-11);border-radius:999px;padding:0 5px}.PHVq-W_gitSyncBadgeAhead{color:var(--dsw-alias-state-warn-label)}.PHVq-W_gitSyncBadgeBehind{color:var(--dsw-alias-state-success-primary)}.PHVq-W_gitCheck{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;flex:none;margin:0}.PHVq-W_gitCheck:disabled{cursor:default}.PHVq-W_gitSectionHint{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none;margin-left:auto}.PHVq-W_gitSectionActions{flex:none;gap:12px;margin-left:auto;display:flex}.PHVq-W_gitRowActions{flex:none;gap:2px;display:none}.PHVq-W_gitRow:hover .PHVq-W_gitRowActions,.PHVq-W_gitRow:focus-within .PHVq-W_gitRowActions{display:inline-flex}.PHVq-W_gitRow:hover .PHVq-W_gitRowHint{display:none}.PHVq-W_gitRowActions .PHVq-W_iconButton{border-radius:4px;width:24px;height:24px}.PHVq-W_gitClean{color:var(--dsw-alias-state-success-primary);text-align:center;flex-direction:column;align-items:center;gap:6px;padding:32px 24px 28px;display:flex}.PHVq-W_gitCleanTitle{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary)}.PHVq-W_gitCleanMeta{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.PHVq-W_gitRowHint{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.PHVq-W_gitSection{border-top:1px solid var(--dsw-alias-border-l1)}.PHVq-W_gitSectionBody{scrollbar-width:thin;overscroll-behavior:none;max-height:160px;overflow:hidden auto}.PHVq-W_gitScrollClip{overflow:clip}.PHVq-W_gitScrollContent{transition:transform .32s cubic-bezier(.22,1.25,.36,1)}@media (prefers-reduced-motion:reduce){.PHVq-W_gitScrollContent{transition:none}}.PHVq-W_gitSectionBodyChanges{max-height:min(320px,40vh)}.PHVq-W_gitSectionGrow{flex-direction:column;flex:auto;min-height:0;display:flex}.PHVq-W_gitSectionBodyHistory{flex:auto;min-height:160px;max-height:none}.PHVq-W_gitSectionFlat{border-top:none}.PHVq-W_gitOperation{border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-state-warn-label);font:var(--dsw-font-xxs-12);align-items:center;gap:6px;padding:8px 12px;display:flex}.PHVq-W_gitOperation>span{flex:1}.PHVq-W_gitSectionHeader{min-height:36px;font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:8px;padding:0 12px;display:flex}.PHVq-W_gitSectionCount{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);flex:none;margin-right:auto;font-weight:400}.PHVq-W_gitSectionToggle{max-width:100%;color:inherit;font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;flex:none;align-items:center;gap:4px;padding:0;display:flex}.PHVq-W_gitSectionChevron,.PHVq-W_gitSectionChevronExpanded{color:var(--dsw-alias-label-tertiary);transition:transform .12s var(--ds-ease-in-out);flex:none}.PHVq-W_gitSectionChevronExpanded{transform:rotate(90deg)}.PHVq-W_gitDangerLink{color:var(--dsw-alias-state-error-primary)}.PHVq-W_gitLink{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-brand-primary);cursor:pointer;background:0 0;border:none;padding:0}.PHVq-W_gitLinkDanger{color:var(--dsw-alias-state-error-primary)}.PHVq-W_gitLink:hover:not(:disabled){text-decoration:underline}.PHVq-W_gitLink:disabled{opacity:.4;cursor:default}.PHVq-W_gitRow{min-height:34px;animation:PHVq-W_dsh-row-in .15s var(--ds-ease-in-out);border-radius:8px;align-items:center;gap:6px;margin:0 6px;padding:0 8px;display:flex}.PHVq-W_gitRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitTree{padding-left:16px}.PHVq-W_gitTreeGroup{width:100%;height:32px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:4px;padding:0 12px;display:flex}.PHVq-W_gitTreeGroupName{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.PHVq-W_gitTreeGroup:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitTreeChildren{border-left:1px solid var(--dsw-alias-border-l2);margin-left:20px}.PHVq-W_gitRowMain{cursor:pointer;text-align:left;background:0 0;border:none;flex:1;align-items:center;gap:8px;min-width:0;padding:3px 0;display:flex}.PHVq-W_gitBadge{text-align:center;width:18px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-secondary);flex:none}.PHVq-W_gitBadge.PHVq-W_gitBadgeModified{color:var(--dsw-alias-state-warn-label)}.PHVq-W_gitBadge.PHVq-W_gitBadgeAdded{color:var(--dsw-alias-state-success-primary)}.PHVq-W_gitBadge.PHVq-W_gitBadgeDeleted{color:var(--dsw-alias-state-error-primary)}.PHVq-W_gitName,.PHVq-W_gitFileName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);flex:1;font-size:13px;overflow:hidden}.PHVq-W_gitFileName{flex:0 auto}.PHVq-W_gitFilePath{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:1 1 0;overflow:hidden}.PHVq-W_gitTagState{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.PHVq-W_gitTagStateSynced{color:var(--dsw-alias-state-success-primary)}.PHVq-W_gitTagStateLocal{color:var(--dsw-alias-state-warn-label)}.PHVq-W_gitEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);padding:4px 12px 8px}.PHVq-W_gitPlaceholder{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px}.PHVq-W_gitError{max-height:30vh;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;padding:8px 12px;overflow-y:auto}.PHVq-W_gitDiff{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;overflow-x:auto}.PHVq-W_gitDiffBody{min-width:640px}.PHVq-W_gitDiffModal{width:min(1200px,100%);max-height:100%;padding-bottom:0}.PHVq-W_gitDiffModalContent{min-height:0}.PHVq-W_gitDiffModalContent>div:last-child{flex:1;min-height:0;margin-top:0;padding:0}.PHVq-W_gitDiffTab{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden auto}.PHVq-W_gitDiffTabHeader{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:8px;height:36px;padding:0 8px 0 12px;display:flex}.PHVq-W_gitDiffTabTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.PHVq-W_gitDiffFile{width:100%;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:baseline;gap:6px;padding:8px 2px 2px;display:flex}.PHVq-W_gitDiffFile:disabled{cursor:default}.PHVq-W_gitDiffFile:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitDiffFileChevron{color:var(--dsw-alias-label-tertiary);flex:none;transform:rotate(0)}.PHVq-W_gitDiffFileChevronExpanded{transform:rotate(90deg)}.PHVq-W_gitDiffFilePath{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.PHVq-W_gitDiffFileOld{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:none;max-width:40%;overflow:hidden}.PHVq-W_gitDiffFileTag{border:1px solid var(--dsw-alias-border-l2);font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:0 6px}.PHVq-W_gitDiffHunk{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);gap:8px;padding:3px 2px;display:flex}.PHVq-W_gitDiffHunkHeader{color:var(--dsw-alias-label-secondary);flex:none}.PHVq-W_gitDiffHunkSection{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.PHVq-W_gitDiffLine{font:var(--dsw-font-markdown-code-block-small);grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;line-height:20px;display:grid}.PHVq-W_gitDiffSide{white-space:pre-wrap;overflow-wrap:anywhere;grid-template-columns:44px minmax(0,1fr);min-width:0;min-height:20px;display:grid}.PHVq-W_gitDiffSide:first-child{border-right:1px solid var(--dsw-alias-border-l1)}.PHVq-W_gitDiffNum{text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none;padding-right:8px}.PHVq-W_gitDiffCode{min-width:0;font:inherit;flex:1;overflow:visible}.PHVq-W_gitDiffDel{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)}.PHVq-W_gitDiffAdd{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}.PHVq-W_gitDiffMeta{padding-left:46px}.PHVq-W_gitDiffMetaText{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);font-style:italic}.PHVq-W_gitDiffExpand{width:100%;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-brand-primary);cursor:pointer;text-align:center;background:0 0;border:none;margin:4px 0;display:block}.PHVq-W_gitDiffExpand:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitConfirmDesc{max-height:40vh;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);white-space:pre-wrap;margin:0;overflow-y:auto}.PHVq-W_gitBranchFlow{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;margin:12px 0;display:grid}.PHVq-W_gitBranchFlow>span:not(:nth-child(2)){border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);text-align:center;text-overflow:ellipsis;white-space:nowrap;border-radius:6px;padding:6px 8px;overflow:hidden}.PHVq-W_gitBranchFlow>select{text-align:center;width:100%}.PHVq-W_gitRebaseWarning{color:var(--dsw-alias-state-warn-label);font:var(--dsw-font-xxs-12);margin:0}.PHVq-W_gitWorktreeCreate{grid-template-columns:minmax(110px,.7fr) minmax(160px,1.3fr) auto;align-items:center;gap:8px;margin-bottom:12px;display:grid}.PHVq-W_gitWorktreeHint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);margin:0 0 12px}.PHVq-W_gitWorktreeList{flex-direction:column;gap:4px;max-height:min(360px,50vh);display:flex;overflow-y:auto}.PHVq-W_gitWorktreeRow{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;align-items:center;gap:6px;padding:4px 6px 4px 10px;display:flex}.PHVq-W_gitWorktreeRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitWorktreeMain{min-width:0;color:inherit;cursor:pointer;text-align:left;background:0 0;border:none;flex-direction:column;flex:1;gap:3px;padding:4px 0;display:flex}.PHVq-W_gitWorktreeMain:disabled{cursor:default;opacity:.55}.PHVq-W_gitWorktreeLine{align-items:center;gap:6px;min-width:0;display:flex}.PHVq-W_gitWorktreeCurrent{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11)}.PHVq-W_gitWorktreePath{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.PHVq-W_gitWorktreeCreate{grid-template-columns:1fr}.PHVq-W_gitCommit{z-index:1;flex-direction:column;gap:6px;margin-top:auto;padding:8px 12px;display:flex;position:sticky;bottom:0}.PHVq-W_gitCommitError{border:1px solid var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-base);font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;border-radius:8px;flex-direction:column;gap:4px;padding:8px 32px 8px 10px;display:flex;position:relative}.PHVq-W_gitCommitErrorClose{color:inherit;font:var(--dsw-font-s-14);cursor:pointer;background:0 0;border:0;position:absolute;top:4px;right:6px}.PHVq-W_gitCommitError summary{cursor:pointer}.PHVq-W_gitCommitErrorDetails{max-height:min(160px,25vh);font:inherit;white-space:pre-wrap;margin:4px 0 0;overflow-y:auto}.PHVq-W_gitCommitCard{background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border-radius:22px;flex-direction:column;gap:12px;padding-top:8px;display:flex}.PHVq-W_gitCommitInput{box-sizing:border-box;field-sizing:content;resize:none;width:100%;min-height:36px;max-height:160px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);caret-color:var(--dsw-alias-state-business-primary);background:0 0;border:none;outline:none;padding:4px 8px 0 14px;line-height:24px;display:block}.PHVq-W_gitCommitInput::placeholder{color:var(--dsw-alias-label-caption)}.PHVq-W_gitCommitFooter{align-items:center;gap:8px;padding:2px 8px 6px 14px;display:flex}.PHVq-W_gitCommitHint{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:1;overflow:hidden}.PHVq-W_gitCommitButton{background:var(--dsw-alias-button-info-fill);width:34px;height:34px;color:var(--dsw-static-neutral-bluish-00);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;padding:0;transition:background-color .1s;display:grid;transform:translateY(-2px)}.PHVq-W_gitCommitButton:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}.PHVq-W_gitCommitButton:disabled{opacity:.4;cursor:default}.PHVq-W_gitLogRow{cursor:pointer;border-radius:8px;align-items:center;gap:8px;min-width:0;height:32px;padding:0 12px;display:flex}.PHVq-W_gitBackToTop{margin-left:auto}.PHVq-W_gitSectionHintAfterLink{margin-left:0}.PHVq-W_gitCompareBar{background:var(--dsw-alias-interactive-bg-hover);font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-secondary);border-radius:6px;align-items:center;gap:8px;margin:0 12px 4px;padding:6px 8px;display:flex}.PHVq-W_gitCompareBar>span{flex:1}.PHVq-W_gitGraph{flex:none;display:block;overflow:visible}.PHVq-W_gitLogRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitLogLine1{align-items:baseline;gap:8px;min-width:0;display:flex}.PHVq-W_gitLogHash{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);flex:none}.PHVq-W_gitLogLine2{flex-wrap:wrap;align-items:center;gap:6px;min-width:0;display:flex}.PHVq-W_gitLogRefs{align-items:center;gap:8px;min-width:0;display:flex}.PHVq-W_gitLogRef{text-overflow:ellipsis;border:1px solid var(--dsw-alias-border-l2);min-width:0;max-width:96px;font:var(--dsw-font-xxxs-strong-11);white-space:nowrap;border-radius:999px;flex:0 auto;padding:0 5px;overflow:hidden}.PHVq-W_gitLogSubject{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);flex:1;font-size:13px;overflow:hidden}.PHVq-W_gitLogMeta{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.PHVq-W_gitLogMore{border:1px solid var(--dsw-alias-border-l2);width:calc(100% - 24px);font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:6px;margin:4px 12px 8px;padding:6px 0;display:block}.PHVq-W_gitLogMore:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.PHVq-W_gitLogMore:disabled{opacity:.5;cursor:default}.PHVq-W_iconButton:focus-visible,.PHVq-W_gitRowMain:focus-visible,.PHVq-W_gitSectionToggle:focus-visible,.PHVq-W_gitLink:focus-visible,.PHVq-W_gitSyncButton:focus-visible,.PHVq-W_gitCheck:focus-visible,.PHVq-W_gitCommitButton:focus-visible,.PHVq-W_gitCommitErrorClose:focus-visible,.PHVq-W_gitCommitError summary:focus-visible,.PHVq-W_gitLogRow:focus-visible,.PHVq-W_gitLogMore:focus-visible,.PHVq-W_gitDiffFile:focus-visible,.PHVq-W_gitDiffExpand:focus-visible{outline:2px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.PHVq-W_gitRow,.PHVq-W_gitSectionChevron,.PHVq-W_gitSectionChevronExpanded{transition:none;animation:none}.PHVq-W_gitBranchTabs{gap:4px;margin-bottom:10px;display:flex}.PHVq-W_gitBranchTab,.PHVq-W_gitBranchTabActive{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);cursor:pointer;background:0 0;border-radius:999px;padding:4px 10px}.PHVq-W_gitBranchTab:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitBranchTabActive{background:var(--dsw-alias-button-info-fill);color:var(--dsw-static-neutral-bluish-00);border-color:#0000}.PHVq-W_gitBranchTools{flex-wrap:wrap;gap:12px;margin-bottom:8px;display:flex}.PHVq-W_gitBranchForce{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);cursor:pointer;align-items:center;gap:6px;margin-bottom:8px;display:flex}.PHVq-W_gitBranchList{flex-direction:column;gap:4px;max-height:min(360px,50vh);display:flex;overflow-y:auto}.PHVq-W_gitBranchRow{border:1px solid var(--dsw-alias-border-l1);cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:4px 10px;display:flex}.PHVq-W_gitBranchRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.PHVq-W_gitBranchRowMain{flex-direction:column;flex:1;gap:3px;min-width:0;padding:4px 0;display:flex}.PHVq-W_gitBranchRowLine{align-items:center;gap:6px;min-width:0;display:flex}.PHVq-W_gitBranchName{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.PHVq-W_gitBranchBadge,.PHVq-W_gitBranchBadgeWarn{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);white-space:nowrap;border-radius:999px;flex:none;padding:0 5px}.PHVq-W_gitBranchBadgeWarn{border-color:var(--dsw-alias-state-warn-label);color:var(--dsw-alias-state-warn-label)}[data-git-worktree-tree]{flex-direction:column;gap:4px;display:flex}[data-git-worktree-tree]>*{flex:none;margin-top:0!important}[data-git-worktree-child]{--dsh-workspace-indent:12px!important}[data-git-worktree-child][hidden]{display:none!important}";
		const tagId = "dsh-git-sidebar/sidebar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-git-sidebar";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var sidebar_module_css_default = {
			"gitSectionBodyHistory": "PHVq-W_gitSectionBodyHistory",
			"gitBranchTabs": "PHVq-W_gitBranchTabs",
			"gitLogLine2": "PHVq-W_gitLogLine2",
			"gitWorktreeCreate": "PHVq-W_gitWorktreeCreate",
			"gitRow": "PHVq-W_gitRow",
			"gitLogMore": "PHVq-W_gitLogMore",
			"gitSection": "PHVq-W_gitSection",
			"gitDiffNum": "PHVq-W_gitDiffNum",
			"gitWorktreeLine": "PHVq-W_gitWorktreeLine",
			"gitLogRefs": "PHVq-W_gitLogRefs",
			"gitScrollContent": "PHVq-W_gitScrollContent",
			"gitDiffSide": "PHVq-W_gitDiffSide",
			"gitCommitInput": "PHVq-W_gitCommitInput",
			"gitName": "PHVq-W_gitName",
			"gitDiffFileTag": "PHVq-W_gitDiffFileTag",
			"gitBranchForce": "PHVq-W_gitBranchForce",
			"gitDiffLine": "PHVq-W_gitDiffLine",
			"gitOperation": "PHVq-W_gitOperation",
			"gitCommitErrorDetails": "PHVq-W_gitCommitErrorDetails",
			"gitSectionChevron": "PHVq-W_gitSectionChevron",
			"gitDiffHunkHeader": "PHVq-W_gitDiffHunkHeader",
			"gitSectionHint": "PHVq-W_gitSectionHint",
			"gitDiffFilePath": "PHVq-W_gitDiffFilePath",
			"gitDiffMetaText": "PHVq-W_gitDiffMetaText",
			"gitWorktreeRow": "PHVq-W_gitWorktreeRow",
			"gitCheck": "PHVq-W_gitCheck",
			"gitCommitError": "PHVq-W_gitCommitError",
			"gitBranchTabActive": "PHVq-W_gitBranchTabActive",
			"gitBranchFlow": "PHVq-W_gitBranchFlow",
			"gitLogLine1": "PHVq-W_gitLogLine1",
			"gitConfirmDesc": "PHVq-W_gitConfirmDesc",
			"gitBranchName": "PHVq-W_gitBranchName",
			"gitTreeChildren": "PHVq-W_gitTreeChildren",
			"iconButton": "PHVq-W_iconButton",
			"gitDiffExpand": "PHVq-W_gitDiffExpand",
			"gitLink": "PHVq-W_gitLink",
			"gitCommitFooter": "PHVq-W_gitCommitFooter",
			"dsh-row-in": "PHVq-W_dsh-row-in",
			"gitDiffModal": "PHVq-W_gitDiffModal",
			"gitCleanMeta": "PHVq-W_gitCleanMeta",
			"gitTagStateSynced": "PHVq-W_gitTagStateSynced",
			"gitDiffModalContent": "PHVq-W_gitDiffModalContent",
			"gitTagState": "PHVq-W_gitTagState",
			"gitLogHash": "PHVq-W_gitLogHash",
			"gitBranchSelect": "PHVq-W_gitBranchSelect",
			"gitLinkDanger": "PHVq-W_gitLinkDanger",
			"gitCommitHint": "PHVq-W_gitCommitHint",
			"gitDiffFileOld": "PHVq-W_gitDiffFileOld",
			"gitBranchBadge": "PHVq-W_gitBranchBadge",
			"gitBadgeModified": "PHVq-W_gitBadgeModified",
			"gitGraph": "PHVq-W_gitGraph",
			"gitTreeGroupName": "PHVq-W_gitTreeGroupName",
			"gitSectionFlat": "PHVq-W_gitSectionFlat",
			"gitSectionBody": "PHVq-W_gitSectionBody",
			"gitSyncBadgeAhead": "PHVq-W_gitSyncBadgeAhead",
			"gitSectionHeader": "PHVq-W_gitSectionHeader",
			"gitDiffCode": "PHVq-W_gitDiffCode",
			"gitLogSubject": "PHVq-W_gitLogSubject",
			"gitScrollClip": "PHVq-W_gitScrollClip",
			"gitHeader": "PHVq-W_gitHeader",
			"gitSectionToggle": "PHVq-W_gitSectionToggle",
			"gitBadgeAdded": "PHVq-W_gitBadgeAdded",
			"gitDiffBody": "PHVq-W_gitDiffBody",
			"gitBadgeDeleted": "PHVq-W_gitBadgeDeleted",
			"gitCommit": "PHVq-W_gitCommit",
			"gitWorktreeHint": "PHVq-W_gitWorktreeHint",
			"gitSyncBadgeBehind": "PHVq-W_gitSyncBadgeBehind",
			"gitSectionChevronExpanded": "PHVq-W_gitSectionChevronExpanded",
			"gitCommitButton": "PHVq-W_gitCommitButton",
			"gitRowHint": "PHVq-W_gitRowHint",
			"gitSectionBodyChanges": "PHVq-W_gitSectionBodyChanges",
			"gitFilePath": "PHVq-W_gitFilePath",
			"gitDiffTabTitle": "PHVq-W_gitDiffTabTitle",
			"gitDiffFileChevron": "PHVq-W_gitDiffFileChevron",
			"gitDiffMeta": "PHVq-W_gitDiffMeta",
			"gitBackToTop": "PHVq-W_gitBackToTop",
			"gitClean": "PHVq-W_gitClean",
			"gitBadge": "PHVq-W_gitBadge",
			"gitSectionHintAfterLink": "PHVq-W_gitSectionHintAfterLink",
			"gitLogRow": "PHVq-W_gitLogRow",
			"gitCommitErrorClose": "PHVq-W_gitCommitErrorClose",
			"gitCompareBar": "PHVq-W_gitCompareBar",
			"gitLogMeta": "PHVq-W_gitLogMeta",
			"gitBranchRow": "PHVq-W_gitBranchRow",
			"gitBranchRowMain": "PHVq-W_gitBranchRowMain",
			"gitDiffAdd": "PHVq-W_gitDiffAdd",
			"gitWorktreeMain": "PHVq-W_gitWorktreeMain",
			"gitSyncButton": "PHVq-W_gitSyncButton",
			"gitDiffHunkSection": "PHVq-W_gitDiffHunkSection",
			"gitBranchRowLine": "PHVq-W_gitBranchRowLine",
			"gitPlaceholder": "PHVq-W_gitPlaceholder",
			"gitTreeGroup": "PHVq-W_gitTreeGroup",
			"gitDiffTab": "PHVq-W_gitDiffTab",
			"gitEmpty": "PHVq-W_gitEmpty",
			"gitSectionGrow": "PHVq-W_gitSectionGrow",
			"git": "PHVq-W_git",
			"gitWorktreeList": "PHVq-W_gitWorktreeList",
			"gitDiffDel": "PHVq-W_gitDiffDel",
			"gitWorktreePath": "PHVq-W_gitWorktreePath",
			"gitSyncBadge": "PHVq-W_gitSyncBadge",
			"gitDiffFile": "PHVq-W_gitDiffFile",
			"gitCleanTitle": "PHVq-W_gitCleanTitle",
			"gitDiffFileChevronExpanded": "PHVq-W_gitDiffFileChevronExpanded",
			"gitBranchTab": "PHVq-W_gitBranchTab",
			"gitSectionActions": "PHVq-W_gitSectionActions",
			"gitCommitCard": "PHVq-W_gitCommitCard",
			"gitDiffTabHeader": "PHVq-W_gitDiffTabHeader",
			"gitRowMain": "PHVq-W_gitRowMain",
			"gitTree": "PHVq-W_gitTree",
			"gitLogRef": "PHVq-W_gitLogRef",
			"gitDangerLink": "PHVq-W_gitDangerLink",
			"gitRowActions": "PHVq-W_gitRowActions",
			"gitDiff": "PHVq-W_gitDiff",
			"gitBranchList": "PHVq-W_gitBranchList",
			"gitBranchBadgeWarn": "PHVq-W_gitBranchBadgeWarn",
			"gitRebaseWarning": "PHVq-W_gitRebaseWarning",
			"gitFileName": "PHVq-W_gitFileName",
			"gitDiffHunk": "PHVq-W_gitDiffHunk",
			"gitWorktreeCurrent": "PHVq-W_gitWorktreeCurrent",
			"gitSectionCount": "PHVq-W_gitSectionCount",
			"gitError": "PHVq-W_gitError",
			"gitTagStateLocal": "PHVq-W_gitTagStateLocal",
			"gitBranchTools": "PHVq-W_gitBranchTools"
		};
		//#endregion
		//#region src/client/ElasticScroll.tsx
		/** Keep native scrolling and its offsets; only pull the content beyond an edge. */
		function ElasticScroll({ children, ...props }) {
			const boxRef = (0, react.useRef)(null);
			const contentRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const box = boxRef.current;
				const content = contentRef.current;
				const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
				let offset = 0;
				let timer;
				let touch;
				const release = () => {
					clearTimeout(timer);
					offset = 0;
					content.style.transition = "";
					content.style.transform = "";
				};
				const pull = (delta) => {
					if (reducedMotion?.matches || box.clientHeight === 0 || delta === 0) return false;
					if (!(delta < 0 ? box.scrollTop <= 0 : box.scrollTop + box.clientHeight >= box.scrollHeight - 1)) {
						release();
						return false;
					}
					clearTimeout(timer);
					offset = Math.max(-36, Math.min(36, offset - delta * .22));
					content.style.transition = "none";
					content.style.transform = `translateY(${offset}px)`;
					return true;
				};
				const wheel = (event) => {
					if (event.defaultPrevented || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
					const delta = event.deltaY * (event.deltaMode === 1 ? 34 : event.deltaMode === 2 ? box.clientHeight : 1);
					if (pull(delta)) {
						event.preventDefault();
						timer = setTimeout(release, 100);
					}
				};
				const touchStart = (event) => {
					release();
					const point = event.touches.length === 1 ? event.touches[0] : void 0;
					touch = point === void 0 ? void 0 : {
						x: point.clientX,
						y: point.clientY
					};
				};
				const touchMove = (event) => {
					const point = event.touches.length === 1 ? event.touches[0] : void 0;
					if (point === void 0 || touch === void 0) {
						touch = void 0;
						release();
						return;
					}
					const delta = touch.y - point.clientY;
					const horizontal = Math.abs(touch.x - point.clientX) > Math.abs(delta);
					touch = {
						x: point.clientX,
						y: point.clientY
					};
					if (!event.defaultPrevented && !horizontal && pull(delta)) event.preventDefault();
				};
				const touchEnd = () => {
					touch = void 0;
					release();
				};
				box.addEventListener("wheel", wheel, { passive: false });
				box.addEventListener("touchstart", touchStart, { passive: true });
				box.addEventListener("touchmove", touchMove, { passive: false });
				box.addEventListener("touchend", touchEnd);
				box.addEventListener("touchcancel", touchEnd);
				reducedMotion?.addEventListener("change", release);
				return () => {
					release();
					box.removeEventListener("wheel", wheel);
					box.removeEventListener("touchstart", touchStart);
					box.removeEventListener("touchmove", touchMove);
					box.removeEventListener("touchend", touchEnd);
					box.removeEventListener("touchcancel", touchEnd);
					reducedMotion?.removeEventListener("change", release);
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				...props,
				ref: boxRef,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.gitScrollClip,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: contentRef,
						className: sidebar_module_css_default.gitScrollContent,
						children
					})
				})
			});
		}
		//#endregion
		//#region src/client/graph.ts
		/** Lay out rows (newest first) into lanes; `parents` are full hashes. */
		function layoutGraph(rows) {
			const lanes = [];
			const out = [];
			let width = 0;
			const freeSlot = () => {
				const idx = lanes.indexOf(null);
				if (idx !== -1) return idx;
				lanes.push(null);
				return lanes.length - 1;
			};
			for (const row of rows) {
				const expecting = lanes.flatMap((hash, idx) => hash === row.hashFull ? [idx] : []);
				const lane = expecting[0] ?? freeSlot();
				const joins = expecting.slice(1);
				for (const idx of joins) lanes[idx] = null;
				const through = lanes.flatMap((hash, idx) => hash !== null && idx !== lane ? [idx] : []);
				lanes[lane] = null;
				const parentLanes = [];
				row.parents.forEach((parent, order) => {
					const existing = order === 0 ? -1 : lanes.indexOf(parent);
					if (existing !== -1) {
						parentLanes.push(existing);
						return;
					}
					const idx = order === 0 ? lane : freeSlot();
					lanes[idx] = parent;
					parentLanes.push(idx);
				});
				width = Math.max(width, lanes.length, lane + 1);
				out.push({
					lane,
					incoming: expecting.length > 0,
					through,
					joins,
					parents: parentLanes
				});
				while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
			}
			return {
				rows: out,
				lanes: width
			};
		}
		//#endregion
		//#region src/client/paths.ts
		/**
		* The path relative to the session's working directory.
		* @param cwd - the explorer root (absolute).
		* @param path - an absolute entry path from the fs-tree.
		* @returns the relative path with '/' separators ('.' for the cwd itself),
		* or `path` unchanged when it lies outside the cwd.
		*
		* The prefix test is case-insensitive: Windows paths (and macOS's
		* case-insensitive volumes) may arrive with different casing than the cwd
		* row, and the containment decision must not depend on it. The returned
		* relative text keeps the caller's own casing.
		*/
		function relativeTo(cwd, path) {
			const base = cwd.replace(/[\\/]+$/, "");
			const norm = (value) => value.replace(/\\/g, "/");
			const nBase = norm(base);
			const nPath = norm(path);
			if (nPath === nBase) return ".";
			if (nPath.toLowerCase().startsWith(`${nBase.toLowerCase()}/`)) return nPath.slice(nBase.length + 1);
			return path;
		}
		//#endregion
		//#region src/client/locales.ts
		/** Git sidebar dictionaries; follow the DSH locale. */
		const zh = {
			git: "源代码管理",
			gitGuideDesc: "查看变更、提交并同步分支",
			worktreeMark: "Git Worktree 工作区",
			close: "关闭",
			refresh: "刷新",
			loading: "加载中…",
			notRepo: "当前目录不是 git 仓库",
			noChanges: "没有变更",
			stage: "Add",
			unstage: "取消 Add",
			stageAll: "全部 Add",
			unstageAll: "全部取消 Add",
			stash: "Stash",
			stashSave: "存入 Stash",
			stashPop: "Pop",
			stashApply: "Apply",
			stashDrop: "Drop",
			stashDropTitle: "丢弃 Stash",
			stashDropDesc: "将永久丢弃 {ref}（不可恢复）。",
			wipCommit: "提交为 WIP",
			wipUndo: "撤销 WIP…",
			wipUndoTitle: "撤销 WIP 提交",
			wipUndoDesc: "将删除当前分支最新的 WIP 提交，其中的改动会回到工作区（不会丢失）。",
			wipUndoConfirm: "撤销",
			wipPushTitle: "推送 WIP 提交",
			wipPushDesc: "当前分支最新的提交是 WIP。推送到远端后就无法在面板里撤销它，只能去终端处理。",
			wipPushConfirm: "仍然推送",
			tag: "Tag",
			tagNew: "新建 Tag",
			tagCreateTitle: "新建 Tag",
			tagNamePlaceholder: "Tag 名，例如 v1.2.0",
			tagMessagePlaceholder: "描述（选填，填写后创建附注 Tag）",
			tagAtCommit: "目标提交：{hash} {subject}",
			tagAtHead: "打在当前分支的最新提交上。",
			tagCreate: "创建",
			tagCreateHere: "创建 Tag…",
			tagCopyName: "复制 Tag 名",
			tagPush: "推送到远端",
			tagSynced: "已同步",
			tagLocal: "未同步",
			tagSyncUnknown: "状态未知",
			tagPushTitle: "推送 Tag 到远端",
			tagPushDesc: "将把 {name} 推送到远端，其他人随后就能看到它。",
			tagDelete: "删除",
			tagDeleteTitle: "删除 Tag",
			tagDeleteDesc: "将删除本地 Tag {name}（远端上的同名 Tag 不受影响）。",
			commitPlaceholder: "提交信息 (Ctrl+Enter)",
			commit: "提交",
			fetch: "Fetch",
			fetchAll: "Fetch All",
			pushBranch: "推送当前分支",
			fetchError: "拉取远端失败",
			pushError: "推送失败",
			uncommittedReminder: "有 {count} 个未提交更改",
			unpushedReminder: "有 {count} 个已提交更改尚未推送",
			behindReminder: "远端有 {count} 个提交待同步",
			checkoutError: "切换分支失败",
			checkoutBlockedByChanges: "切换会覆盖工作区中的未提交更改。请先提交或存入 Stash，再重试。",
			errorDetails: "查看 Git 详情",
			branchActions: "更多操作",
			groupView: "视图",
			viewAsList: "以列表形式查看",
			viewAsTree: "以树形式查看",
			groupRemote: "远端",
			groupBranch: "分支",
			groupWorkingTree: "工作区",
			mergeBranchMenu: "合并分支…",
			rebaseBranchMenu: "变基分支…",
			worktreesMenu: "Git Worktree…",
			branchManageMenu: "分支管理…",
			resetToRemoteMenu: "回到远端状态…",
			resetToRemoteTitle: "回到远端状态",
			resetToRemoteDesc: "将撤销本地领先远端的 {count} 个提交，其中的改动会回到工作区（不会丢失）。",
			resetToRemoteConfirm: "回到远端状态",
			tagNewMenu: "新建 Tag…",
			mergeBranch: "合并分支",
			mergeTitle: "合并分支",
			mergeDesc: "将「{source}」合并到当前分支「{current}」。",
			mergeError: "合并分支失败",
			rebaseBranch: "变基分支",
			rebaseTitle: "变基分支",
			rebaseDesc: "将当前分支「{current}」变基到「{target}」之上。",
			rebaseWarning: "变基会重写当前分支的提交历史；已推送的分支请谨慎操作。",
			rebaseError: "变基分支失败",
			worktrees: "Git Worktree",
			worktreeBranch: "分支",
			worktreePath: "Worktree 路径",
			worktreePathPlaceholder: "输入新 Worktree 路径",
			worktreeAdd: "新建",
			worktreeCreateBranch: "+ 新建分支",
			worktreeNewBranch: "新分支名称",
			worktreeBase: "基准分支",
			worktreeNoBranch: "没有可用分支：已签出的分支不能再创建 Worktree。",
			worktreeOpenSession: "打开此 Worktree 的 DSH 会话",
			worktreeCurrent: "当前",
			worktreeLocked: "已锁定",
			worktreeDetached: "分离 HEAD",
			worktreeRemove: "删除 Worktree",
			worktreeCurrentRemove: "不能删除当前 Worktree",
			worktreeRemoveTitle: "删除 Worktree",
			worktreeRemoveDesc: "将删除 Worktree 目录「{path}」，并从左侧移除它的工作区（会话不删除）。如果存在未提交更改，Git 会拒绝操作。",
			worktreeMerge: "合并分支",
			worktreeMergeTitle: "合并 Worktree",
			worktreeMergeDesc: "将「{source}」合并到目标分支「{target}」。选择「合并并删除」时，还会删除该 Worktree 并从左侧移除它的工作区（会话不删除）。",
			worktreeMergeRemove: "合并并删除",
			operationConflict: "{operation}尚未完成，解决冲突后继续，或中止操作。",
			operationContinue: "继续",
			operationAbort: "中止",
			history: "历史",
			staged: "已 Add",
			changes: "变更",
			showAsList: "列表",
			showAsTree: "树形",
			synced: "已与远端同步",
			viewDiff: "查看差异",
			historyRecent: "最近 {count} 条",
			backToTop: "回到顶部",
			cleanTree: "工作区没有变更",
			sync: "同步",
			syncTitle: "拉取远端，并推送当前分支的新提交",
			syncError: "同步失败",
			syncRebaseTitle: "远端有新提交",
			syncRebaseDesc: "远端领先 {count} 个提交，直接推送会被拒绝。将先把当前分支变基到远端之上，再推送本地提交；未提交的改动会自动暂存并恢复，遇到冲突会停下，解决后可继续或中止。",
			syncRebaseConfirm: "变基并推送",
			commitHint: "将提交 {count} 个文件",
			commitHintEmpty: "没有可提交的变更（先勾选文件）",
			unstaged: "未 Add",
			untracked: "未跟踪",
			cancel: "取消",
			diffEmpty: "没有文本差异",
			diffLoadError: "加载差异失败",
			diffBinary: "二进制",
			diffAdded: "新增",
			diffDeleted: "删除",
			diffRenamed: "重命名",
			diffExpand: "展开其余 {count} 行",
			diffCollapse: "收起",
			discard: "放弃更改",
			discardTitle: "放弃更改",
			discardDesc: "将丢弃「{path}」的工作区修改（不可恢复）。",
			discardNewTitle: "删除新增文件",
			discardNewDesc: "「{path}」是本次变更新增的文件，HEAD 中没有可恢复的版本，放弃即从磁盘删除（不可恢复）。",
			discardAll: "放弃所有更改",
			discardAllShort: "放弃全部",
			discardAllTitle: "放弃所有更改",
			discardAllDesc: "将放弃全部 {count} 项未提交更改：恢复已提交文件，并删除已 Add 和未 Add 的新增文件及目录（不可恢复）。忽略文件及嵌套仓库不清理。",
			viewCommitDiff: "打开更改",
			checkoutBranch: "签出",
			checkoutDetached: "签出（分离 HEAD）",
			branchCreate: "创建分支…",
			branchCreateTitle: "创建分支",
			branchCreateConfirm: "创建",
			branchNamePlaceholder: "分支名，例如 feature/login",
			branchAtCommit: "从提交 {hash} {subject} 创建。",
			branchDelete: "删除分支",
			branchDeleteTitle: "删除分支",
			branchDeleteDesc: "将删除本地分支「{name}」（仅限已合并的分支）。",
			branchManageTitle: "分支管理",
			branchLocalTab: "本地分支",
			branchRemoteTab: "远程分支",
			branchSelectMerged: "选择已合并",
			branchSelectGone: "选择上游已删除",
			branchSelectNone: "清除选择",
			branchMerged: "已合并",
			branchGone: "上游已删除",
			branchCurrentBadge: "当前",
			branchNoUpstream: "无上游",
			branchForce: "强制删除（含未合并提交）",
			branchDeleteSelected: "删除所选（{count}）",
			branchPrune: "清理失效的远程引用",
			branchPruneTitle: "清理失效的远程引用",
			branchPruneDesc: "将删除本地记录的、在远端已不存在的远程跟踪引用（{remote}），远端和本地分支都不受影响。",
			branchDeleteLocalTitle: "删除本地分支",
			branchDeleteLocalDesc: "将删除 {count} 个本地分支：{names}。未合并的分支会被 Git 拒绝。",
			branchDeleteForceDesc: "将强制删除 {count} 个本地分支：{names}。其中未合并的提交可能无法找回。",
			branchDeleteRemoteTitle: "删除远程分支",
			branchDeleteRemoteDesc: "将从远端删除 {count} 个分支：{names}。删除后其他人也会看到它们消失。",
			branchNamesMore: "等 {count} 个",
			branchDeleteFailedMore: "…另有 {count} 个分支删除失败",
			branchDeleteConfirm: "删除",
			branchNoRemote: "当前仓库没有配置远端。",
			branchEmpty: "没有分支",
			compareRemote: "与远程比较",
			compareMergeBase: "与合并基础比较",
			compareMergeBaseTitle: "合并基础 ↔ {hash}",
			compareWith: "相较于…",
			comparePick: "再点击一个提交，与 {hash} 比较",
			addToChat: "添加到聊天",
			addToChatText: "提交 {hash}：{subject}",
			explainCommit: "解释更改",
			explainCommitText: "请解释提交 {hash}（{subject}）做了哪些更改，以及为什么。",
			promptError: "发送到聊天失败",
			copyShortHash: "复制短哈希",
			copyFullHash: "复制完整哈希",
			copySubject: "复制提交信息",
			revertCommit: "还原此提交",
			revertTitle: "还原此提交",
			revertDesc: "将在当前分支创建一个反转「{subject}」的新提交。",
			cherryPickCommit: "捡取此提交",
			cherryPickTitle: "捡取此提交",
			cherryPickDesc: "将「{subject}」的更改应用到当前分支。",
			timeJustNow: "刚刚",
			timeMinutesAgo: "{n} 分钟前",
			timeHoursAgo: "{n} 小时前",
			timeYesterday: "昨天",
			timeDaysAgo: "{n} 天前",
			timeMonthsAgo: "{n} 个月前",
			timeYearsAgo: "{n} 年前",
			loadMore: "加载更多",
			historyLoadError: "加载更多历史失败",
			openEditor: "打开编辑器",
			copyRelative: "复制相对地址",
			copyAbsolute: "复制绝对地址"
		};
		const en = {
			git: "Source Control",
			gitGuideDesc: "Review changes, commit, and sync branches",
			worktreeMark: "Git Worktree workspace",
			close: "Close",
			refresh: "Refresh",
			loading: "Loading…",
			notRepo: "This directory is not a git repository",
			noChanges: "No changes",
			stage: "Stage",
			unstage: "Unstage",
			stageAll: "Stage all",
			unstageAll: "Unstage all",
			stash: "Stash",
			stashSave: "Stash all",
			stashPop: "Pop",
			stashApply: "Apply",
			stashDrop: "Drop",
			stashDropTitle: "Drop stash",
			stashDropDesc: "Permanently drop {ref} (not recoverable).",
			wipCommit: "Commit as WIP",
			wipUndo: "Undo WIP…",
			wipUndoTitle: "Undo WIP commit",
			wipUndoDesc: "Remove the latest WIP commit on the current branch; its changes go back to the working tree (nothing is lost).",
			wipUndoConfirm: "Undo",
			wipPushTitle: "Push WIP commit",
			wipPushDesc: "The latest commit on this branch is a WIP commit. Once pushed it can no longer be undone from this panel, only from a terminal.",
			wipPushConfirm: "Push anyway",
			tag: "Tag",
			tagNew: "New tag",
			tagCreateTitle: "New tag",
			tagNamePlaceholder: "Tag name, e.g. v1.2.0",
			tagMessagePlaceholder: "Message (optional; creates an annotated tag)",
			tagAtCommit: "Target commit: {hash} {subject}",
			tagAtHead: "Tags the latest commit on the current branch.",
			tagCreate: "Create",
			tagCreateHere: "Create tag…",
			tagCopyName: "Copy tag name",
			tagPush: "Push to remote",
			tagSynced: "Synced",
			tagLocal: "Not synced",
			tagSyncUnknown: "Unknown",
			tagPushTitle: "Push tag to remote",
			tagPushDesc: "Push {name} to the remote, where everyone else will see it.",
			tagDelete: "Delete",
			tagDeleteTitle: "Delete tag",
			tagDeleteDesc: "Delete the local tag {name} (a remote tag of the same name is untouched).",
			commitPlaceholder: "Commit message (Ctrl+Enter)",
			commit: "Commit",
			fetch: "Fetch",
			fetchAll: "Fetch All",
			pushBranch: "Push current branch",
			fetchError: "Fetch failed",
			pushError: "Push failed",
			uncommittedReminder: "{count} uncommitted change(s)",
			unpushedReminder: "{count} committed change(s) not pushed",
			behindReminder: "{count} remote commit(s) to sync",
			checkoutError: "Branch switch failed",
			checkoutBlockedByChanges: "Switching would overwrite uncommitted changes. Commit or stash them, then try again.",
			errorDetails: "Show Git details",
			branchActions: "More actions",
			groupView: "View",
			viewAsList: "View as list",
			viewAsTree: "View as tree",
			groupRemote: "Remote",
			groupBranch: "Branch",
			groupWorkingTree: "Working tree",
			mergeBranchMenu: "Merge branch…",
			rebaseBranchMenu: "Rebase branch…",
			worktreesMenu: "Git worktrees…",
			branchManageMenu: "Manage branches…",
			resetToRemoteMenu: "Reset to remote…",
			resetToRemoteTitle: "Reset to remote",
			resetToRemoteDesc: "Unwind the {count} local commit(s) ahead of the remote; their changes go back to the working tree (nothing is lost).",
			resetToRemoteConfirm: "Reset to remote",
			tagNewMenu: "New tag…",
			mergeBranch: "Merge branch",
			mergeTitle: "Merge branch",
			mergeDesc: "Merge \"{source}\" into the current branch \"{current}\".",
			mergeError: "Branch merge failed",
			rebaseBranch: "Rebase branch",
			rebaseTitle: "Rebase branch",
			rebaseDesc: "Rebase the current branch \"{current}\" onto \"{target}\".",
			rebaseWarning: "Rebase rewrites the current branch history; use caution if the branch has been pushed.",
			rebaseError: "Branch rebase failed",
			worktrees: "Git Worktrees",
			worktreeBranch: "Branch",
			worktreePath: "Worktree path",
			worktreePathPlaceholder: "Enter a new Worktree path",
			worktreeAdd: "Create",
			worktreeCreateBranch: "+ Create new branch",
			worktreeNewBranch: "New branch name",
			worktreeBase: "Base branch",
			worktreeNoBranch: "No branches are available; a checked-out branch cannot be used by another Worktree.",
			worktreeOpenSession: "Open the DSH session for this Worktree",
			worktreeCurrent: "Current",
			worktreeLocked: "Locked",
			worktreeDetached: "Detached HEAD",
			worktreeRemove: "Remove Worktree",
			worktreeCurrentRemove: "The current Worktree cannot be removed",
			worktreeRemoveTitle: "Remove Worktree",
			worktreeRemoveDesc: "Remove the Worktree directory \"{path}\" and its Workspace from the sidebar (Sessions are kept). Git refuses when it contains uncommitted changes.",
			worktreeMerge: "Merge branch",
			worktreeMergeTitle: "Merge Worktree",
			worktreeMergeDesc: "Merge \"{source}\" into the target branch \"{target}\". \"Merge and remove\" also removes the Worktree and its Workspace from the sidebar (Sessions are kept).",
			worktreeMergeRemove: "Merge and remove",
			operationConflict: "{operation} is incomplete. Resolve conflicts and continue, or abort the operation.",
			operationContinue: "Continue",
			operationAbort: "Abort",
			history: "History",
			staged: "Staged",
			changes: "Changes",
			showAsList: "List",
			showAsTree: "Tree",
			synced: "Up to date with remote",
			viewDiff: "View diff",
			historyRecent: "Latest {count}",
			backToTop: "Back to top",
			cleanTree: "Working tree is clean",
			sync: "Sync",
			syncTitle: "Fetch, then push the current branch",
			syncError: "Sync failed",
			syncRebaseTitle: "Remote has new commits",
			syncRebaseDesc: "The remote is {count} commit(s) ahead, so a plain push would be rejected. The current branch will be rebased onto the remote first, then pushed; uncommitted changes are stashed and restored automatically, and on conflict it stops so you can continue or abort.",
			syncRebaseConfirm: "Rebase and push",
			commitHint: "Will commit {count} file(s)",
			commitHintEmpty: "Nothing staged to commit (tick files first)",
			unstaged: "Unstaged",
			untracked: "Untracked",
			cancel: "Cancel",
			diffEmpty: "No text changes",
			diffLoadError: "Failed to load diff",
			diffBinary: "Binary",
			diffAdded: "Added",
			diffDeleted: "Deleted",
			diffRenamed: "Renamed",
			diffExpand: "Expand {count} more rows",
			diffCollapse: "Collapse",
			discard: "Discard changes",
			discardTitle: "Discard changes",
			discardDesc: "This discards the worktree changes of \"{path}\" (not recoverable).",
			discardNewTitle: "Delete new file",
			discardNewDesc: "\"{path}\" is a file this change added, so HEAD holds no version to restore: discarding it deletes the file (not recoverable).",
			discardAll: "Discard all changes",
			discardAllShort: "Discard all",
			discardAllTitle: "Discard all changes",
			discardAllDesc: "Discard all {count} uncommitted changes: restore committed files and delete added and untracked files and directories (not recoverable). Ignored files and nested repositories are not cleaned.",
			viewCommitDiff: "Open changes",
			checkoutBranch: "Checkout",
			checkoutDetached: "Checkout (detached)",
			branchCreate: "Create branch…",
			branchCreateTitle: "Create branch",
			branchCreateConfirm: "Create",
			branchNamePlaceholder: "Branch name, e.g. feature/login",
			branchAtCommit: "From commit {hash} {subject}.",
			branchDelete: "Delete branch",
			branchDeleteTitle: "Delete branch",
			branchDeleteDesc: "Deletes the local branch \"{name}\" (merged branches only).",
			branchManageTitle: "Manage branches",
			branchLocalTab: "Local",
			branchRemoteTab: "Remote",
			branchSelectMerged: "Select merged",
			branchSelectGone: "Select gone upstream",
			branchSelectNone: "Clear selection",
			branchMerged: "Merged",
			branchGone: "Upstream gone",
			branchCurrentBadge: "Current",
			branchNoUpstream: "No upstream",
			branchForce: "Force-delete (unmerged commits included)",
			branchDeleteSelected: "Delete selected ({count})",
			branchPrune: "Prune stale remote refs",
			branchPruneTitle: "Prune stale remote refs",
			branchPruneDesc: "Removes remote-tracking refs of {remote} that no longer exist on the remote; no branch is deleted anywhere.",
			branchDeleteLocalTitle: "Delete local branches",
			branchDeleteLocalDesc: "Deletes {count} local branches: {names}. Git refuses unmerged ones.",
			branchDeleteForceDesc: "Force-deletes {count} local branches: {names}. Unmerged commits may be unrecoverable.",
			branchDeleteRemoteTitle: "Delete remote branches",
			branchDeleteRemoteDesc: "Deletes {count} branches on the remote: {names}. Everyone else will see them disappear.",
			branchNamesMore: "and {count} more",
			branchDeleteFailedMore: "…and {count} more branches failed",
			branchDeleteConfirm: "Delete",
			branchNoRemote: "This repository has no remote configured.",
			branchEmpty: "No branches",
			compareRemote: "Compare with remote",
			compareMergeBase: "Compare with merge base",
			compareMergeBaseTitle: "merge base ↔ {hash}",
			compareWith: "Compare with…",
			comparePick: "Click another commit to compare with {hash}",
			addToChat: "Add to chat",
			addToChatText: "Commit {hash}: {subject}",
			explainCommit: "Explain changes",
			explainCommitText: "Explain what commit {hash} ({subject}) changed and why.",
			promptError: "Could not send to chat",
			copyShortHash: "Copy short hash",
			copyFullHash: "Copy full hash",
			copySubject: "Copy subject",
			revertCommit: "Revert commit",
			revertTitle: "Revert commit",
			revertDesc: "Create a new commit on the current branch that reverts \"{subject}\".",
			cherryPickCommit: "Cherry-pick commit",
			cherryPickTitle: "Cherry-pick commit",
			cherryPickDesc: "Apply the changes of \"{subject}\" to the current branch.",
			timeJustNow: "just now",
			timeMinutesAgo: "{n} min ago",
			timeHoursAgo: "{n} h ago",
			timeYesterday: "yesterday",
			timeDaysAgo: "{n} days ago",
			timeMonthsAgo: "{n} months ago",
			timeYearsAgo: "{n} years ago",
			loadMore: "Load more",
			historyLoadError: "Failed to load more history",
			openEditor: "Open editor",
			copyRelative: "Copy relative path",
			copyAbsolute: "Copy absolute path"
		};
		const LOCALE_NS = "gitSidebar";
		/** The DSH locale service attached by the client apply (absent → browser detection). */
		let localeService;
		/**
		* Attach (or detach, with undefined) the DSH locale service. The sidebar
		* mounts its own React root outside the slot system's locale seat, so the
		* service rides this module-level holder: components keep calling the plain
		* `t()` function, and the Sidebar root's locale subscription re-renders the
		* whole tree on switches.
		*/
		function attachLocale(service) {
			localeService = service;
		}
		/**
		* The active locale id ('zh' | 'en'): the DSH locale service's snapshot when
		* attached, else the browser language.
		*/
		function activeLocale() {
			return localeService?.getSnapshot().active ?? (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
		}
		/** Translate a copy key; `{name}` placeholders interpolate from `params`. */
		function t(key, params) {
			let text = (activeLocale().toLowerCase().startsWith("zh") ? zh : en)[key];
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		/** Format a Git author date relative to now. */
		function relativeTime(iso) {
			const normalized = iso.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, "$1T$2$3:$4");
			const then = Date.parse(normalized);
			if (Number.isNaN(then)) return iso;
			const seconds = Math.floor((Date.now() - then) / 1e3);
			if (seconds < 60) return t("timeJustNow");
			if (seconds < 3600) return t("timeMinutesAgo", { n: Math.floor(seconds / 60) });
			if (seconds < 86400) return t("timeHoursAgo", { n: Math.floor(seconds / 3600) });
			if (seconds < 172800) return t("timeYesterday");
			if (seconds < 2592e3) return t("timeDaysAgo", { n: Math.floor(seconds / 86400) });
			if (seconds < 31536e3) return t("timeMonthsAgo", { n: Math.floor(seconds / 2592e3) });
			return t("timeYearsAgo", { n: Math.floor(seconds / 31536e3) });
		}
		//#endregion
		//#region src/client/GitView.tsx
		/**
		* The source-control panel: status list (staged vs unstaged), stage/unstage,
		* the stash stack (save / pop / apply / drop), commit with a message box,
		* branch switch, and a VSCode-like history — rows
		* carry branch decorations, author and relative time. Clicking a changed
		* file or a history row opens a diff modal. File rows and history rows open a
		* right-click context menu with advanced operations (open in editor, discard,
		* revert, cherry-pick, copy paths/hashes). Refresh is manual + on mount/
		* focus, plus a 5 s local poll and a 30 s remote fetch while visible.
		*/
		/** The XY status letters a row badge shows (X = index, Y = worktree). */
		function badgeOf(entry) {
			const index = entry.xy[0];
			const worktree = entry.xy[1];
			if (index !== void 0 && index !== " " && index !== "?") return index;
			if (worktree !== void 0 && worktree !== " " && worktree !== "?") return worktree;
			return "?";
		}
		/** The badge color class for a status letter (M amber, A/? green, D red). */
		function badgeTone(letter) {
			if (letter === "M" || letter === "R") return sidebar_module_css_default.gitBadgeModified;
			if (letter === "A" || letter === "?") return sidebar_module_css_default.gitBadgeAdded;
			if (letter === "D") return sidebar_module_css_default.gitBadgeDeleted;
		}
		/**
		* Split Git's slash-delimited path for the changes list. An untracked
		* directory arrives as `dir/` and keeps its trailing slash in the name.
		*/
		function listPathParts(path) {
			const trailing = path.endsWith("/") ? "/" : "";
			const bare = trailing === "" ? path : path.slice(0, -1);
			const slash = bare.lastIndexOf("/");
			return slash === -1 ? {
				name: path,
				directory: ""
			} : {
				name: bare.slice(slash + 1) + trailing,
				directory: bare.slice(0, slash)
			};
		}
		/** Nest changed files by directory for the tree view; the returned root has path ''. */
		function changeTree(entries) {
			const root = {
				path: "",
				name: "",
				directories: [],
				files: []
			};
			for (const entry of entries) {
				const { directory } = listPathParts(entry.path);
				let node = root;
				if (directory !== "") for (const segment of directory.split("/")) {
					const path = node.path === "" ? segment : `${node.path}/${segment}`;
					let child = node.directories.find((candidate) => candidate.path === path);
					if (child === void 0) {
						child = {
							path,
							name: segment,
							directories: [],
							files: []
						};
						node.directories.push(child);
					}
					node = child;
				}
				node.files.push(entry);
			}
			const compact = (node) => {
				let current = node;
				while (current.files.length === 0 && current.directories.length === 1) {
					const only = current.directories[0];
					current = {
						...only,
						name: `${current.name}/${only.name}`
					};
				}
				return {
					...current,
					directories: current.directories.map(compact).sort((left, right) => left.name.localeCompare(right.name))
				};
			};
			return {
				...root,
				directories: root.directories.map(compact).sort((left, right) => left.name.localeCompare(right.name))
			};
		}
		/** Whether the entry carries STAGED (index) changes — the X letter is set. */
		function isStagedEntry(entry) {
			const index = entry.xy[0];
			return index !== void 0 && index !== " " && index !== "?";
		}
		/** Whether the entry carries UNSTAGED (worktree) changes — the Y letter is set
		*  (untracked `??` counts as unstaged: it is a worktree-only change). A file
		*  with both letters set ('MM') lands in BOTH sections. */
		function isUnstagedEntry(entry) {
			if (entry.xy === "??") return true;
			const worktree = entry.xy[1];
			return worktree !== void 0 && worktree !== " " && worktree !== "?";
		}
		/** Whether the entry is untracked (`??`): git diff never includes it. */
		function isUntracked(entry) {
			return badgeOf(entry) === "?";
		}
		/**
		* The confirmation copy for discarding one row. A file this change added has
		* no version in HEAD, so discarding it deletes it instead of restoring it —
		* the dialog has to say which of the two is about to happen.
		*/
		/** How many branch names a confirm dialog or an error spells out; the rest
		*  collapse into a count, so cleaning up a hundred branches cannot grow the
		*  dialog past the screen. */
		const NAME_PREVIEW = 8;
		/** `a, b, c 等 N 个` — the name list a confirm dialog shows. */
		function previewNames(names) {
			return names.length <= NAME_PREVIEW ? names.join(", ") : `${names.slice(0, NAME_PREVIEW).join(", ")} ${t("branchNamesMore", { count: names.length - NAME_PREVIEW })}`;
		}
		function discardPrompt(entry) {
			const added = badgeOf(entry) === "A" || isUntracked(entry);
			return {
				title: t(added ? "discardNewTitle" : "discardTitle"),
				description: t(added ? "discardNewDesc" : "discardDesc", { path: entry.path })
			};
		}
		const GRAPH_LANE = 14;
		const GRAPH_ROW = 32;
		const GRAPH_COLORS = [
			"#2f6fdb",
			"#d0741c",
			"#2a9d5c",
			"#b84bd6",
			"#d63b5f",
			"#1f9fb5"
		];
		/** The SVG rails of one history row (see {@link layoutGraph}). */
		function GraphCell(props) {
			const { row, lanes } = props;
			const x = (lane) => lane * GRAPH_LANE + GRAPH_LANE / 2;
			const color = (lane) => GRAPH_COLORS[lane % GRAPH_COLORS.length];
			const mid = GRAPH_ROW / 2;
			const cx = x(row.lane);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: sidebar_module_css_default.gitGraph,
				width: lanes * GRAPH_LANE,
				height: GRAPH_ROW,
				"aria-hidden": "true",
				children: [
					row.incoming && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: cx,
						y1: 0,
						x2: cx,
						y2: mid,
						stroke: color(row.lane),
						strokeWidth: 2
					}),
					row.through.map((lane) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: x(lane),
						y1: 0,
						x2: x(lane),
						y2: GRAPH_ROW,
						stroke: color(lane),
						strokeWidth: 2
					}, `t${lane}`)),
					row.joins.map((lane) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: `M${x(lane)} 0 C ${x(lane)} ${mid} ${cx} 0 ${cx} ${mid}`,
						fill: "none",
						stroke: color(lane),
						strokeWidth: 2
					}, `j${lane}`)),
					row.parents.map((lane, order) => lane === row.lane ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: cx,
						y1: mid,
						x2: cx,
						y2: GRAPH_ROW,
						stroke: color(lane),
						strokeWidth: 2
					}, `p${order}`) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: `M${cx} ${mid} C ${cx} ${GRAPH_ROW} ${x(lane)} ${mid} ${x(lane)} ${GRAPH_ROW}`,
						fill: "none",
						stroke: color(lane),
						strokeWidth: 2
					}, `p${order}`)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx,
						cy: mid,
						r: 4,
						fill: color(row.lane)
					})
				]
			});
		}
		/** The last path segment (tab title for a file's diff). */
		function baseName(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		/** The ref names of one log row's decorations (`HEAD -> main` → `main`), deduped. */
		function refNames(refs) {
			return [...new Set(refs.split(",").map((ref) => ref.trim()).filter((ref) => ref !== "").map((ref) => ref.includes(" -> ") ? ref.slice(ref.indexOf(" -> ") + 4) : ref).map((ref) => ref.startsWith("tag: ") ? ref.slice(5) : ref))];
		}
		/** History batch size: the log loads lazily in pages so a long history never
		*  floods the panel at once (the end of the log is reached by paging). */
		const LOG_BATCH = 20;
		const DEFAULT_SECTIONS = {
			changes: true,
			stash: false,
			tag: false,
			history: true
		};
		const viewMemory = /* @__PURE__ */ new Map();
		function memoryFor(scope) {
			const key = JSON.stringify([scope.sessionId, scope.cwd ?? null]);
			let memory = viewMemory.get(key);
			if (memory === void 0) {
				memory = {
					expanded: { ...DEFAULT_SECTIONS },
					changeView: "list",
					collapsedDirectories: /* @__PURE__ */ new Set(),
					logCount: 0,
					scroll: {}
				};
				viewMemory.set(key, memory);
			}
			return memory;
		}
		/** Distance from the history list's bottom (px) at which the next page is fetched. */
		const LOAD_MORE_THRESHOLD = 48;
		/** Background status poll interval while the panel is visible. */
		const AUTO_REFRESH_MS = 5e3;
		const AUTO_FETCH_MS = 3e4;
		/** Start a worktree draft on a new branch based on the current branch. */
		function defaultWorktreeDraft(currentBranch, pathPrefix) {
			return {
				createNew: true,
				newBranch: "",
				base: currentBranch,
				path: `${pathPrefix}new-branch`
			};
		}
		const INITIAL_WORKTREE_DRAFT = defaultWorktreeDraft("", "");
		function GitView(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitViewContent, { ...props }, JSON.stringify([props.scope.sessionId, props.scope.cwd ?? null]));
		}
		function GitViewContent(props) {
			const { scope, onOpenFile, onOpenDiff, onOpenWorktree, onWorktreeRemoved, onPrompt } = props;
			const memory = memoryFor(scope);
			const snapshot = memory.snapshot;
			const viewId = (0, react.useId)();
			const [status, setStatus] = (0, react.useState)(snapshot?.status ?? null);
			const [loading, setLoading] = (0, react.useState)(snapshot === void 0);
			const [error, setError] = (0, react.useState)(null);
			const [remoteError, setRemoteError] = (0, react.useState)(null);
			const [branchNames, setBranchNames] = (0, react.useState)(snapshot?.branchNames ?? []);
			const [logEntries, setLogEntries] = (0, react.useState)(snapshot?.logEntries ?? []);
			const [stashEntries, setStashEntries] = (0, react.useState)(snapshot?.stashEntries ?? []);
			const [tagEntries, setTagEntries] = (0, react.useState)(snapshot?.tagEntries ?? []);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [commitError, setCommitError] = (0, react.useState)(null);
			const checkoutBlocked = commitError?.startsWith(`${t("checkoutError")}:`) && commitError.includes("Your local changes to the following files would be overwritten by checkout:");
			const [branchMenuOpen, setBranchMenuOpen] = (0, react.useState)(false);
			const [mergeSource, setMergeSource] = (0, react.useState)(null);
			const [rebaseTarget, setRebaseTarget] = (0, react.useState)(null);
			const [worktrees, setWorktrees] = (0, react.useState)(snapshot?.worktrees ?? []);
			const [worktreeOpen, setWorktreeOpen] = (0, react.useState)(false);
			const [worktreeBranch, setWorktreeBranch] = (0, react.useState)("");
			const [worktreePath, setWorktreePath] = (0, react.useState)("");
			const [worktreePathPrefix, setWorktreePathPrefix] = (0, react.useState)(snapshot?.worktreePathPrefix ?? "");
			const [worktreeCreateNew, setWorktreeCreateNew] = (0, react.useState)(INITIAL_WORKTREE_DRAFT.createNew);
			const [worktreeNewBranch, setWorktreeNewBranch] = (0, react.useState)(INITIAL_WORKTREE_DRAFT.newBranch);
			const [worktreeBase, setWorktreeBase] = (0, react.useState)(INITIAL_WORKTREE_DRAFT.base);
			const [worktreeError, setWorktreeError] = (0, react.useState)(null);
			const [worktreeMerge, setWorktreeMerge] = (0, react.useState)(null);
			const [worktreeTarget, setWorktreeTarget] = (0, react.useState)("");
			const [operation, setOperation] = (0, react.useState)(snapshot?.operation ?? null);
			/** Branch manager: the open modal, which list it shows, and the checked rows. */
			const [branchManagerOpen, setBranchManagerOpen] = (0, react.useState)(false);
			const [branchTab, setBranchTab] = (0, react.useState)("local");
			const [branchOverview, setBranchOverview] = (0, react.useState)(null);
			const [branchSelection, setBranchSelection] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [branchForce, setBranchForce] = (0, react.useState)(false);
			const [branchManagerError, setBranchManagerError] = (0, react.useState)(null);
			const graph = (0, react.useMemo)(() => layoutGraph(logEntries), [logEntries]);
			/** Whether the history was fully paged (a batch shorter than LOG_BATCH). */
			const [logEnded, setLogEnded] = (0, react.useState)(snapshot?.logEnded ?? false);
			const [logLoadingMore, setLogLoadingMore] = (0, react.useState)(false);
			/** The open file-row context menu (cursor position for the portaled Menu). */
			const [fileMenu, setFileMenu] = (0, react.useState)(null);
			/** The open stash-row context menu. */
			const [stashMenu, setStashMenu] = (0, react.useState)(null);
			/** The last failed stash operation, shown inside the stash section itself. */
			const [stashError, setStashError] = (0, react.useState)(null);
			/** The open tag-row context menu. */
			const [tagMenu, setTagMenu] = (0, react.useState)(null);
			/** The last failed tag operation, shown inside the tag section itself. */
			const [tagError, setTagError] = (0, react.useState)(null);
			/** The open create-tag draft; `commit` null means HEAD. */
			const [tagDraft, setTagDraft] = (0, react.useState)(null);
			/** A failed create, shown inside the create dialog so the input survives a retry. */
			const [tagDraftError, setTagDraftError] = (0, react.useState)(null);
			/** The open create-branch draft (commit the branch starts from). */
			const [branchDraft, setBranchDraft] = (0, react.useState)(null);
			const [branchDraftError, setBranchDraftError] = (0, react.useState)(null);
			/** Whether the history box is scrolled far enough for a "back to top" affordance. */
			const [historyScrolled, setHistoryScrolled] = (0, react.useState)(false);
			/** "Compare with…": the first commit picked; the next history row click opens the range diff. */
			const [compareFrom, setCompareFrom] = (0, react.useState)(null);
			/** The open history-row context menu. */
			const [historyMenu, setHistoryMenu] = (0, react.useState)(null);
			/** The pending destructive action awaiting confirmation. */
			const [confirm, setConfirm] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (status !== null) memory.snapshot = {
					status,
					branchNames,
					logEntries,
					logEnded,
					stashEntries,
					tagEntries,
					worktrees,
					worktreePathPrefix,
					operation
				};
			}, [
				memory,
				status,
				branchNames,
				logEntries,
				logEnded,
				stashEntries,
				tagEntries,
				worktrees,
				worktreePathPrefix,
				operation
			]);
			const [expandedSections, setExpandedSections] = (0, react.useState)(() => ({ ...memory.expanded }));
			const [changeView, setChangeView] = (0, react.useState)(() => memory.changeView);
			const [collapsedDirectories, setCollapsedDirectories] = (0, react.useState)(() => memory.collapsedDirectories);
			(0, react.useEffect)(() => {
				memory.expanded = expandedSections;
			}, [memory, expandedSections]);
			(0, react.useEffect)(() => {
				memory.changeView = changeView;
			}, [memory, changeView]);
			(0, react.useEffect)(() => {
				memory.collapsedDirectories = collapsedDirectories;
			}, [memory, collapsedDirectories]);
			/** Scroll boxes report their offset here; the first render after a remount puts it back. */
			const rootRef = (0, react.useRef)(null);
			const scrollProps = (key) => ({
				"data-scroll-key": key,
				onScroll: (event) => {
					memory.scroll[key] = event.currentTarget.scrollTop;
				}
			});
			/** How much history is on screen, so a background refresh re-reads that much, not just page one. */
			const logCountRef = (0, react.useRef)(memory.logCount);
			const logResetId = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (logEntries.length > 0) {
					logCountRef.current = logEntries.length;
					memory.logCount = logEntries.length;
				}
			}, [memory, logEntries]);
			/** Reload everything; `silent` skips the loading placeholder (background polls). */
			const refreshId = (0, react.useRef)(0);
			const refresh = (0, react.useCallback)(async (silent = false) => {
				const requestId = ++refreshId.current;
				const resetId = logResetId.current;
				if (!silent && memory.snapshot === void 0) setLoading(true);
				setError(null);
				api.gitTags(scope).catch(() => ({ entries: memory.snapshot?.tagEntries ?? [] })).then((result) => {
					if (requestId === refreshId.current) setTagEntries(result.entries);
				});
				const logCount = Math.max(LOG_BATCH, logCountRef.current);
				try {
					const [, branchResult, logResult, worktreeResult, operationResult, stashResult] = await Promise.all([
						api.gitStatus(scope).then((result) => {
							if (requestId === refreshId.current) setStatus(result);
						}),
						api.gitBranch(scope).catch(() => ({
							current: "",
							names: []
						})),
						api.gitLog(scope, logCount, 0).catch(() => []),
						api.gitWorktrees(scope).catch(() => ({
							entries: [],
							pathPrefix: ""
						})),
						api.gitOperation(scope).catch(() => ({ operation: null })),
						api.gitStashList(scope).catch(() => ({ entries: [] }))
					]);
					if (requestId !== refreshId.current) return;
					setBranchNames(branchResult.names);
					if (resetId === logResetId.current) {
						setLogEntries(logResult);
						setLogEnded(logResult.length < logCount);
					}
					setWorktrees(worktreeResult.entries);
					setWorktreePathPrefix(worktreeResult.pathPrefix);
					setOperation(operationResult.operation);
					setStashEntries(stashResult.entries);
					const available = branchResult.names.filter((name) => !worktreeResult.entries.some((entry) => entry.branch === name));
					setWorktreeBranch((branch) => available.includes(branch) ? branch : available[0] ?? "");
					setWorktreeBase((base) => branchResult.names.includes(base) ? base : branchResult.current);
					setWorktreePath((path) => path !== "" ? path : `${worktreeResult.pathPrefix}${(available[0] ?? "new-worktree").replace(/[^\w.-]+/g, "-")}`);
				} catch (reason) {
					if (requestId === refreshId.current) setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					if (requestId === refreshId.current) setLoading(false);
				}
			}, [
				scope.sessionId,
				scope.cwd,
				memory
			]);
			(0, react.useEffect)(() => {
				refresh();
				return () => {
					refreshId.current += 1;
				};
			}, [refresh]);
			/** Load the branch manager rows; only the open modal needs them, so this
			*  stays out of `refresh` (three more `for-each-ref` runs per poll). */
			const loadBranchOverview = (0, react.useCallback)(async () => {
				try {
					setBranchOverview(await api.gitBranchList(scope));
				} catch (reason) {
					setBranchManagerError(reason instanceof Error ? reason.message : String(reason));
				}
			}, [scope.sessionId, scope.cwd]);
			const restoredRef = (0, react.useRef)(false);
			(0, react.useLayoutEffect)(() => {
				if (loading || restoredRef.current || rootRef.current === null) return;
				restoredRef.current = true;
				for (const box of rootRef.current.querySelectorAll("[data-scroll-key]")) {
					const key = box.dataset.scrollKey;
					if (memory.scroll[key] !== void 0) box.scrollTop = memory.scroll[key];
				}
			}, [loading, memory]);
			/**
			* The chat composer card's distance from the bottom edge, mirrored under the
			* commit card so both cards end on one line. The card moves when the chat's
			* stats row appears or the font size changes, so it is measured, not fixed;
			* null (no visible composer beside this pane) keeps the stylesheet's 8px.
			*/
			const [commitInset, setCommitInset] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const root = rootRef.current;
				if (root === null) return;
				const observer = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(() => {
					measure();
				});
				let watched = null;
				const measure = () => {
					const card = [...document.querySelectorAll("[data-composer-card]")].find((node) => node.getClientRects().length > 0);
					const seat = card?.closest("[data-composer-seat]") ?? card ?? null;
					if (seat !== watched) {
						if (watched !== null) observer?.unobserve(watched);
						if (seat !== null) observer?.observe(seat);
						watched = seat;
					}
					const inset = card === void 0 ? null : Math.round(root.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom);
					setCommitInset(inset !== null && inset >= 0 && inset <= 160 ? inset : null);
				};
				observer?.observe(root);
				window.addEventListener("resize", measure);
				const timer = window.setInterval(measure, 2e3);
				measure();
				return () => {
					observer?.disconnect();
					window.removeEventListener("resize", measure);
					window.clearInterval(timer);
				};
			}, []);
			const busyRef = (0, react.useRef)(busy);
			const remoteFetchRef = (0, react.useRef)(null);
			busyRef.current = busy || logLoadingMore;
			(0, react.useEffect)(() => {
				const tick = () => {
					if (document.visibilityState === "visible" && !busyRef.current) refresh(true);
				};
				const timer = setInterval(tick, AUTO_REFRESH_MS);
				window.addEventListener("focus", tick);
				document.addEventListener("visibilitychange", tick);
				return () => {
					clearInterval(timer);
					window.removeEventListener("focus", tick);
					document.removeEventListener("visibilitychange", tick);
				};
			}, [refresh]);
			(0, react.useEffect)(() => {
				setRemoteError(null);
				if (!status?.isRepo) return;
				let active = true;
				let fetching = false;
				const tick = async () => {
					if (document.visibilityState !== "visible" || busyRef.current || fetching) return;
					fetching = true;
					const request = api.gitFetch(scope);
					remoteFetchRef.current = request;
					try {
						await request;
						if (active) {
							setRemoteError(null);
							await refresh(true);
						}
					} catch (reason) {
						if (active) setRemoteError(`${t("fetchError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
					} finally {
						fetching = false;
						if (remoteFetchRef.current === request) remoteFetchRef.current = null;
					}
				};
				tick();
				const timer = setInterval(() => {
					tick();
				}, AUTO_FETCH_MS);
				window.addEventListener("focus", tick);
				document.addEventListener("visibilitychange", tick);
				return () => {
					active = false;
					clearInterval(timer);
					window.removeEventListener("focus", tick);
					document.removeEventListener("visibilitychange", tick);
				};
			}, [refresh, status?.isRepo]);
			/** Append the next history page (lazy: only when the user asks for more). */
			const loadMoreLog = async () => {
				if (logLoadingMore || logEnded) return;
				const resetId = logResetId.current;
				setLogLoadingMore(true);
				try {
					const next = await api.gitLog(scope, LOG_BATCH, logEntries.length);
					if (resetId !== logResetId.current) return;
					setLogEntries((entries) => [...entries, ...next]);
					if (next.length < LOG_BATCH) setLogEnded(true);
				} catch (reason) {
					if (resetId === logResetId.current) setCommitError(`${t("historyLoadError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setLogLoadingMore(false);
				}
			};
			/** Scroll the history back to the top and drop the paged-in tail (back to page one). */
			const backToTop = () => {
				logResetId.current += 1;
				const box = rootRef.current?.querySelector("[data-scroll-key=\"history\"]");
				if (box !== null && box !== void 0) box.scrollTop = 0;
				memory.scroll.history = 0;
				setHistoryScrolled(false);
				if (logEntries.length > LOG_BATCH) {
					setLogEntries((entries) => entries.slice(0, LOG_BATCH));
					setLogEnded(false);
					logCountRef.current = LOG_BATCH;
					memory.logCount = LOG_BATCH;
				}
			};
			/** The diff for one changed file. */
			const openWorktreeDiff = (entry, staged) => {
				onOpenDiff({
					id: `diff:w:${staged ? "s" : "u"}:${entry.path}`,
					type: "diff",
					title: baseName(entry.path),
					diff: {
						kind: "worktree",
						path: entry.path,
						staged,
						untracked: isUntracked(entry)
					}
				});
			};
			/** Local branch names decorating a history row (remote refs and HEAD excluded). */
			const localBranchesAt = (entry) => refNames(entry.refs).filter((name) => name !== "HEAD" && !name.startsWith("tag: ") && branchNames.includes(name));
			const openRangeDiff = (from, to, mergeBase, title) => {
				onOpenDiff({
					id: `diff:r:${from}..${to}:${mergeBase ? "mb" : "raw"}`,
					type: "diff",
					title,
					diff: {
						kind: "range",
						from,
						to,
						mergeBase,
						title
					}
				});
			};
			const createBranch = async () => {
				const draft = branchDraft;
				if (draft === null || draft.name.trim() === "" || busy) return;
				setBusy(true);
				setBranchDraftError(null);
				try {
					await api.gitBranchCreate(scope, draft.name.trim(), draft.commit.hashFull);
					setBranchDraft(null);
					await refresh();
				} catch (reason) {
					setBranchDraftError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const sendPrompt = async (text) => {
				try {
					await onPrompt(text);
				} catch (reason) {
					setCommitError(`${t("promptError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				}
			};
			/** A history row click opens its diff, or finishes a pending "compare with…". */
			const pickHistoryRow = (entry) => {
				if (compareFrom === null) {
					openCommitDiff(entry);
					return;
				}
				const from = compareFrom;
				setCompareFrom(null);
				if (from.hashFull !== entry.hashFull) openRangeDiff(from.hashFull, entry.hashFull, false, `${from.hash} ↔ ${entry.hash}`);
			};
			/** The diff for one commit. */
			const openCommitDiff = (entry) => {
				onOpenDiff({
					id: `diff:c:${entry.hashFull}`,
					type: "diff",
					title: `${entry.hash} ${entry.subject}`,
					diff: {
						kind: "commit",
						hash: entry.hash,
						hashFull: entry.hashFull,
						subject: entry.subject
					}
				});
			};
			const stageEntry = async (entry, staged) => {
				setBusy(true);
				try {
					if (staged) await api.gitUnstage(scope, entry.path);
					else await api.gitStage(scope, entry.path);
					await refresh();
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const stageAll = async (staged) => {
				setBusy(true);
				try {
					if (staged) await api.gitUnstage(scope);
					else await api.gitStage(scope);
					await refresh();
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			/** Stage everything and make a WIP commit; failures surface like a failed commit. */
			const wipCommit = async () => {
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitWipCommit(scope);
					await refresh();
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			/** Run one stash operation, then refresh; failures surface like a failed commit. */
			const runStashAction = async (action) => {
				setBusy(true);
				setStashError(null);
				try {
					await action();
					await refresh();
				} catch (reason) {
					setStashError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			/** Create the drafted tag. The dialog stays open on failure so a rejected
			*  name can be corrected without retyping the message. */
			const createTag = async () => {
				const draft = tagDraft;
				if (draft === null || draft.name.trim() === "" || busy) return;
				setBusy(true);
				setTagDraftError(null);
				setTagError(null);
				try {
					await api.gitTagCreate(scope, draft.name.trim(), draft.message.trim(), draft.commit?.hashFull);
					setTagDraft(null);
					await refresh();
				} catch (reason) {
					setTagDraftError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const commit = async () => {
				const message = commitMsg.trim();
				if (message === "" || busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitCommit(scope, message);
					setCommitMsg("");
					await refresh();
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const checkout = async (branch) => {
				if (branch === status?.branch || busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitCheckout(scope, branch);
					await refresh();
				} catch (reason) {
					setCommitError(`${t("checkoutError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			/** 'sync' = fetch, then push when the branch is ahead (the header button). */
			/**
			* Sync = fetch, then look at the fresh ahead/behind: behind means the push
			* would be rejected, so ask to rebase onto the upstream first; otherwise push
			* when ahead (a WIP HEAD asks first, see `syncGuarded`).
			*/
			const syncRemote = async (action) => {
				if (busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					if (action === "push") {
						await api.gitPush(scope);
						await refresh();
						return;
					}
					await remoteFetchRef.current?.catch(() => {});
					await api.gitFetch(scope, action === "fetch-all");
					if (action !== "sync") {
						await refresh();
						return;
					}
					const fresh = await api.gitStatus(scope);
					if (fresh.behind > 0 && fresh.ahead === 0) {
						await api.gitFastForward(scope);
						await refresh();
						return;
					}
					await refresh();
					if (fresh.behind > 0) {
						setBusy(false);
						runConfirmed({
							title: t("syncRebaseTitle"),
							description: t("syncRebaseDesc", { count: fresh.behind }) + (headIsWip ? `\n${t("wipPushDesc")}` : ""),
							confirmLabel: t("syncRebaseConfirm"),
							onConfirm: async () => {
								await api.gitRebase(scope, "@{upstream}");
								if (fresh.ahead > 0) await api.gitPush(scope);
							}
						});
						return;
					}
					if (fresh.ahead > 0) {
						setBusy(false);
						pushGuarded();
						return;
					}
				} catch (reason) {
					const label = action === "sync" ? t("syncError") : action === "push" ? t("pushError") : t("fetchError");
					setCommitError(`${label}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const merge = async (branch) => {
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitMerge(scope, branch);
				} catch (reason) {
					setCommitError(`${t("mergeError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					await refresh();
					setBusy(false);
				}
			};
			const addWorktree = async () => {
				const path = worktreePath.trim();
				const branch = worktreeCreateNew ? worktreeNewBranch.trim() : worktreeBranch;
				if (path === "" || branch === "" || busy) return;
				setBusy(true);
				setWorktreeError(null);
				try {
					const created = await api.gitWorktreeAdd(scope, path, branch, worktreeCreateNew ? worktreeBase : void 0);
					setWorktreePath("");
					await refresh();
					await onOpenWorktree(created.path);
					setWorktreeOpen(false);
				} catch (reason) {
					setWorktreeError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const rebase = async (branch) => {
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitRebase(scope, branch);
				} catch (reason) {
					setCommitError(`${t("rebaseError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					await refresh();
					setBusy(false);
				}
			};
			const openWorktree = async (path) => {
				if (busy) return;
				setBusy(true);
				setWorktreeError(null);
				try {
					await onOpenWorktree(path);
				} catch (reason) {
					setWorktreeError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setBusy(false);
				}
			};
			const mergeWorktree = async (entry, remove) => {
				const target = worktrees.find((candidate) => candidate.path === worktreeTarget);
				if (entry.branch === void 0 || target === void 0 || busy) return;
				setWorktreeMerge(null);
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitWorktreeMerge(scope, target.path, entry.branch);
					if (remove) await onWorktreeRemoved((await api.gitWorktreeRemove(scope, entry.path)).path);
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					await refresh();
					try {
						await onOpenWorktree(target.path);
					} catch (reason) {
						setCommitError(reason instanceof Error ? reason.message : String(reason));
					}
					setBusy(false);
				}
			};
			const finishOperation = async (abort) => {
				if (operation === null || busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					if (abort) await api.gitOperationAbort(scope, operation);
					else await api.gitOperationContinue(scope, operation);
				} catch (reason) {
					setCommitError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					await refresh();
					setBusy(false);
				}
			};
			/** Run one destructive operation after the confirm modal, then refresh. */
			const runConfirmed = (confirmState, reportError = setCommitError) => {
				setConfirm({
					...confirmState,
					onConfirm: async () => {
						setBusy(true);
						reportError(null);
						try {
							await confirmState.onConfirm();
							await refresh();
						} catch (reason) {
							reportError(reason instanceof Error ? reason.message : String(reason));
						} finally {
							setBusy(false);
						}
					}
				});
			};
			/** Discard every change after the confirm modal (menu item and the
			*  changes header's shortcut share it). */
			const discardAllGuarded = () => {
				runConfirmed({
					title: t("discardAllTitle"),
					description: t("discardAllDesc", { count: discardableCount }),
					confirmLabel: t("discardAll"),
					onConfirm: () => api.gitDiscardAll(scope)
				});
			};
			/** Open the branch manager with a clean selection. */
			const openBranchManager = () => {
				setBranchManagerError(null);
				setBranchSelection(/* @__PURE__ */ new Set());
				setBranchForce(false);
				setBranchTab("local");
				setBranchOverview(null);
				setBranchManagerOpen(true);
				loadBranchOverview();
			};
			/** Delete every checked branch in one batch; the failures come back per
			*  branch, so a partial failure still reports exactly what survived. */
			const deleteSelectedBranches = () => {
				const names = [...branchSelection];
				if (names.length === 0) return;
				const remote = branchTab === "remote";
				const force = branchForce && !remote;
				setBranchManagerOpen(false);
				runConfirmed({
					title: t(remote ? "branchDeleteRemoteTitle" : "branchDeleteLocalTitle"),
					description: t(remote ? "branchDeleteRemoteDesc" : force ? "branchDeleteForceDesc" : "branchDeleteLocalDesc", {
						count: names.length,
						names: previewNames(names)
					}),
					confirmLabel: t("branchDeleteConfirm"),
					onConfirm: async () => {
						const { failed } = await api.gitBranchDelete(scope, names, {
							remote,
							force
						});
						setBranchSelection(new Set(failed.map((entry) => entry.name)));
						if (failed.length > 0) {
							await refresh();
							const lines = failed.slice(0, NAME_PREVIEW).map((entry) => `${entry.name}: ${entry.message}`);
							if (failed.length > NAME_PREVIEW) lines.push(t("branchDeleteFailedMore", { count: failed.length - NAME_PREVIEW }));
							throw new Error(lines.join("\n"));
						}
					}
				});
			};
			/** The rows the branch manager currently lists. */
			const branchRows = (branchTab === "local" ? branchOverview?.local : branchOverview?.remotes) ?? [];
			/** Check every listed row matching `pick`; the current branch is never deletable. */
			const selectBranches = (pick) => {
				setBranchSelection(new Set(branchRows.filter((entry) => !entry.current && pick(entry)).map((entry) => entry.name)));
			};
			/** Drop remote-tracking refs whose branch no longer exists on the remote. */
			const pruneRemoteBranches = () => {
				setBranchManagerOpen(false);
				runConfirmed({
					title: t("branchPruneTitle"),
					description: t("branchPruneDesc", { remote: branchOverview?.remote ?? "" }),
					confirmLabel: t("branchPrune"),
					onConfirm: () => api.gitBranchPrune(scope)
				});
			};
			/** Copy `text` to the clipboard (best-effort; no visual feedback needed — the menu closes). */
			const copy = (text) => {
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text);
			};
			const openFileMenu = (event, entry, staged) => {
				event.preventDefault();
				event.stopPropagation();
				setFileMenu({
					entry,
					staged,
					x: event.clientX,
					y: event.clientY
				});
			};
			/** The stash-row menu opens on left OR right click: a right-click-only menu
			*  on a fresh section is not discoverable, and the row has no other action. */
			const openStashMenu = (event, entry) => {
				event.preventDefault();
				event.stopPropagation();
				setStashMenu({
					entry,
					x: event.clientX,
					y: event.clientY
				});
			};
			/** The tag-row menu opens on left OR right click, for the same reason as the stash row. */
			const openTagMenu = (event, entry) => {
				event.preventDefault();
				event.stopPropagation();
				setTagMenu({
					entry,
					x: event.clientX,
					y: event.clientY
				});
			};
			const openHistoryMenu = (event, entry) => {
				event.preventDefault();
				event.stopPropagation();
				setHistoryMenu({
					entry,
					x: event.clientX,
					y: event.clientY
				});
			};
			const entries = status?.entries ?? [];
			const stagedEntries = entries.filter(isStagedEntry);
			/** Whether "stage all" has nothing left to do (every row fully staged). */
			const allStaged = entries.length > 0 && entries.every((entry) => isStagedEntry(entry) && !isUnstagedEntry(entry));
			const headIsWip = logEntries.find((entry) => /^HEAD\b/.test(entry.refs))?.subject === "WIP";
			/** Push, but ask first when that would publish a WIP commit (it cannot be undone from the panel afterwards). */
			const pushGuarded = () => {
				if (!headIsWip) {
					syncRemote("push");
					return;
				}
				runConfirmed({
					title: t("wipPushTitle"),
					description: t("wipPushDesc"),
					confirmLabel: t("wipPushConfirm"),
					onConfirm: () => api.gitPush(scope)
				});
			};
			const discardableCount = new Set(entries.map((entry) => entry.path)).size;
			const toggleSection = (section) => {
				setExpandedSections((current) => ({
					...current,
					[section]: !current[section]
				}));
			};
			/** One row per path: the checkbox IS the stage toggle ('MM' shows indeterminate). */
			const renderEntry = (entry) => {
				const staged = isStagedEntry(entry) && !isUnstagedEntry(entry);
				const partial = isStagedEntry(entry) && isUnstagedEntry(entry);
				const path = listPathParts(entry.path);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.gitRow,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: sidebar_module_css_default.gitCheck,
							checked: staged,
							ref: (el) => {
								if (el !== null) el.indeterminate = partial;
							},
							"aria-label": staged ? t("unstage") : t("stage"),
							title: staged ? t("unstage") : t("stage"),
							disabled: busy,
							onChange: () => {
								stageEntry(entry, staged);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: sidebar_module_css_default.gitRowMain,
							title: entry.path,
							onClick: () => {
								openWorktreeDiff(entry, staged);
							},
							onContextMenu: (event) => {
								openFileMenu(event, entry, staged);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${sidebar_module_css_default.gitBadge} ${badgeTone(badgeOf(entry)) ?? ""}`,
									children: badgeOf(entry)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitFileName,
									children: path.name
								}),
								changeView === "list" && path.directory !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitFilePath,
									children: path.directory
								})
							]
						}),
						(isUntracked(entry) || staged) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitRowHint,
							children: isUntracked(entry) ? t("untracked") : t("staged")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidebar_module_css_default.gitRowActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("viewDiff"),
								title: t("viewDiff"),
								onClick: () => {
									openWorktreeDiff(entry, staged);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.5",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 8h12M2 4h8M2 12h8" })
								})
							}), !isUntracked(entry) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("discard"),
								title: t("discard"),
								disabled: busy,
								onClick: () => {
									runConfirmed({
										...discardPrompt(entry),
										confirmLabel: t("discard"),
										onConfirm: () => api.gitDiscard(scope, entry.path)
									});
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.5",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 4L2 8l4 4M2 8h8a3 3 0 010 6" })
								})
							})]
						})
					]
				}, entry.path);
			};
			/** Sub-folders first, then the folder's own files; a folder row folds its whole subtree. */
			const renderDirectoryContents = (node) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [node.directories.map((directory) => {
				const collapsed = collapsedDirectories.has(directory.path);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-change-directory": directory.path,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: sidebar_module_css_default.gitTreeGroup,
						title: directory.path,
						"aria-expanded": !collapsed,
						onClick: () => {
							setCollapsedDirectories((current) => {
								const next = new Set(current);
								if (next.has(directory.path)) next.delete(directory.path);
								else next.add(directory.path);
								return next;
							});
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: collapsed ? sidebar_module_css_default.gitSectionChevron : sidebar_module_css_default.gitSectionChevronExpanded }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitTreeGroupName,
							children: directory.name
						})]
					}), !collapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitTreeChildren,
						children: renderDirectoryContents(directory)
					})]
				}, directory.path);
			}), node.files.map(renderEntry)] });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.git,
				ref: rootRef,
				...scrollProps("root"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitHeader,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: sidebar_module_css_default.gitBranchSelect,
								value: status?.branch ?? "",
								onChange: (event) => {
									checkout(event.target.value);
								},
								disabled: busy || status !== null && !status.isRepo,
								children: [(status?.branch ?? "") !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: status.branch,
									children: status.branch
								}), branchNames.filter((name) => name !== status?.branch).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: name,
									children: name
								}, name))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: sidebar_module_css_default.gitSyncButton,
								title: t("syncTitle"),
								disabled: busy || status !== null && !status.isRepo || status?.branch === "HEAD",
								onClick: () => {
									syncRemote("sync");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										width: "14",
										height: "14",
										viewBox: "0 0 16 16",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.5",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 13V3M2 6l3-3 3 3M11 3v10M8 10l3 3 3-3" })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("sync") }),
									(status?.behind ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: `${sidebar_module_css_default.gitSyncBadge} ${sidebar_module_css_default.gitSyncBadgeBehind}`,
										children: ["↓", status.behind]
									}),
									(status?.ahead ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: `${sidebar_module_css_default.gitSyncBadge} ${sidebar_module_css_default.gitSyncBadgeAhead}`,
										children: ["↑", status.ahead]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: branchMenuOpen,
								onClose: () => {
									setBranchMenuOpen(false);
								},
								items: [
									{
										type: "label",
										id: "label-view",
										text: t("groupView")
									},
									{
										id: "change-view",
										label: t(changeView === "tree" ? "viewAsList" : "viewAsTree")
									},
									{
										type: "separator",
										id: "view-separator"
									},
									{
										type: "label",
										id: "label-remote",
										text: t("groupRemote")
									},
									{
										id: "fetch-all",
										label: t("fetchAll")
									},
									{
										id: "push",
										label: t("pushBranch"),
										disabled: status?.branch === "HEAD"
									},
									{
										type: "separator",
										id: "remote-separator"
									},
									{
										type: "label",
										id: "label-branch",
										text: t("groupBranch")
									},
									{
										id: "merge",
										label: t("mergeBranchMenu"),
										disabled: branchNames.every((name) => name === status?.branch)
									},
									{
										id: "rebase",
										label: t("rebaseBranchMenu"),
										disabled: branchNames.every((name) => name === status?.branch)
									},
									{
										id: "worktree",
										label: t("worktreesMenu")
									},
									{
										id: "branch-manage",
										label: t("branchManageMenu")
									},
									{
										id: "reset-to-remote",
										label: t("resetToRemoteMenu"),
										disabled: (status?.ahead ?? 0) === 0 || (status?.behind ?? 0) > 0
									},
									{
										type: "separator",
										id: "branch-separator"
									},
									{
										type: "label",
										id: "label-worktree",
										text: t("groupWorkingTree")
									},
									{
										id: "stage-all",
										label: allStaged ? t("unstageAll") : t("stageAll"),
										disabled: entries.length === 0
									},
									{
										id: "stash-save",
										label: t("stashSave"),
										disabled: entries.length === 0
									},
									{
										id: "wip-commit",
										label: t("wipCommit"),
										disabled: entries.length === 0
									},
									{
										id: "wip-undo",
										label: t("wipUndo"),
										disabled: !headIsWip
									},
									{
										id: "tag-new",
										label: t("tagNewMenu")
									},
									{
										id: "discard-all",
										label: t("discardAll"),
										danger: true,
										disabled: discardableCount === 0
									},
									{
										type: "separator",
										id: "refresh-separator"
									},
									{
										id: "refresh",
										label: t("refresh")
									}
								],
								onSelect: (id) => {
									const branch = branchNames.find((name) => name !== status?.branch) ?? null;
									setBranchMenuOpen(false);
									if (id === "change-view") setChangeView((current) => current === "tree" ? "list" : "tree");
									if (id === "fetch-all") syncRemote("fetch-all");
									if (id === "push") pushGuarded();
									if (id === "refresh") refresh();
									if (id === "stage-all") stageAll(allStaged);
									if (id === "stash-save") runStashAction(() => api.gitStash(scope));
									if (id === "wip-commit") wipCommit();
									if (id === "wip-undo") runConfirmed({
										title: t("wipUndoTitle"),
										description: t("wipUndoDesc"),
										confirmLabel: t("wipUndoConfirm"),
										onConfirm: () => api.gitWipUndo(scope)
									});
									if (id === "tag-new") {
										setTagDraftError(null);
										setTagDraft({
											commit: null,
											name: "",
											message: ""
										});
									}
									if (id === "discard-all") discardAllGuarded();
									if (id === "branch-manage") openBranchManager();
									if (id === "merge") setMergeSource(branch);
									if (id === "rebase") setRebaseTarget(branch);
									if (id === "reset-to-remote") runConfirmed({
										title: t("resetToRemoteTitle"),
										description: t("resetToRemoteDesc", { count: status?.ahead ?? 0 }),
										confirmLabel: t("resetToRemoteConfirm"),
										onConfirm: () => api.gitResetToUpstream(scope)
									});
									if (id === "worktree") {
										const draft = defaultWorktreeDraft(status?.branch ?? "", worktreePathPrefix);
										setWorktreeError(null);
										setWorktreeCreateNew(draft.createNew);
										setWorktreeNewBranch(draft.newBranch);
										setWorktreeBase(draft.base);
										setWorktreePath(draft.path);
										setWorktreeOpen(true);
									}
								},
								portal: true,
								align: "end",
								compact: true,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.iconButton,
									"aria-label": t("branchActions"),
									title: t("branchActions"),
									disabled: busy,
									onClick: () => {
										setBranchMenuOpen((open) => !open);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, { size: 16 })
								})
							})
						]
					}),
					loading && status === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!loading && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitError,
						children: error
					}),
					remoteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitError,
						role: "alert",
						children: remoteError
					}),
					!loading && status !== null && !status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("notRepo")
					}),
					operation !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitOperation,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("operationConflict", { operation: t(operation === "merge" ? "mergeBranch" : "rebaseBranch") }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "outline",
								disabled: busy,
								onClick: () => {
									finishOperation(true);
								},
								children: t("operationAbort")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "primary",
								disabled: busy,
								onClick: () => {
									finishOperation(false);
								},
								children: t("operationContinue")
							})
						]
					}),
					status !== null && status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${sidebar_module_css_default.gitSection} ${sidebar_module_css_default.gitSectionFlat}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSectionHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: sidebar_module_css_default.gitSectionToggle,
									"aria-expanded": expandedSections.changes,
									"aria-controls": `git-changes-${viewId}`,
									onClick: () => {
										toggleSection("changes");
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: expandedSections.changes ? sidebar_module_css_default.gitSectionChevronExpanded : sidebar_module_css_default.gitSectionChevron }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("changes") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitSectionCount,
											children: entries.length
										})
									]
								}), entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: sidebar_module_css_default.gitSectionActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `${sidebar_module_css_default.gitLink} ${sidebar_module_css_default.gitLinkDanger}`,
											disabled: busy || discardableCount === 0,
											onClick: discardAllGuarded,
											children: t("discardAllShort")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.gitLink,
											disabled: busy,
											onClick: () => {
												stageAll(allStaged);
											},
											children: allStaged ? t("unstageAll") : t("stageAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.gitLink,
											onClick: () => {
												setChangeView((current) => current === "tree" ? "list" : "tree");
											},
											children: t(changeView === "tree" ? "showAsList" : "showAsTree")
										})
									]
								})]
							}), expandedSections.changes && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ElasticScroll, {
								id: `git-changes-${viewId}`,
								className: `${sidebar_module_css_default.gitSectionBody} ${sidebar_module_css_default.gitSectionBodyChanges}`,
								...scrollProps("changes"),
								children: [entries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: sidebar_module_css_default.gitClean,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											width: "28",
											height: "28",
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "1.5",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
												cx: "12",
												cy: "12",
												r: "9"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 12l3 3 5-6" })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitCleanTitle,
											children: t("cleanTree")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitCleanMeta,
											children: status.behind > 0 ? t("behindReminder", { count: status.behind }) : status.ahead > 0 ? t("unpushedReminder", { count: status.ahead }) : t("synced")
										})
									]
								}), changeView === "list" ? entries.map(renderEntry) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitTree,
									children: renderDirectoryContents(changeTree(entries))
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.gitSection,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitSectionHeader,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: sidebar_module_css_default.gitSectionToggle,
										"aria-expanded": expandedSections.stash,
										"aria-controls": `git-stash-entries-${viewId}`,
										onClick: () => {
											toggleSection("stash");
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: expandedSections.stash ? sidebar_module_css_default.gitSectionChevronExpanded : sidebar_module_css_default.gitSectionChevron }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("stash") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitSectionCount,
												children: stashEntries.length
											})
										]
									})
								}),
								stashError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitError,
									children: stashError
								}),
								expandedSections.stash && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ElasticScroll, {
									id: `git-stash-entries-${viewId}`,
									className: sidebar_module_css_default.gitSectionBody,
									...scrollProps("stash"),
									children: [stashEntries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitEmpty,
										children: t("noChanges")
									}), stashEntries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitRow,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: sidebar_module_css_default.gitRowMain,
											title: `${entry.ref}  ${entry.message}`,
											onClick: (event) => {
												openStashMenu(event, entry);
											},
											onContextMenu: (event) => {
												openStashMenu(event, entry);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogHash,
												children: entry.ref
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitName,
												children: entry.message
											})]
										})
									}, entry.ref))]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${sidebar_module_css_default.gitSection} ${sidebar_module_css_default.gitSectionFlat}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitSectionHeader,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: sidebar_module_css_default.gitSectionToggle,
										"aria-expanded": expandedSections.tag,
										"aria-controls": `git-tag-entries-${viewId}`,
										onClick: () => {
											toggleSection("tag");
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: expandedSections.tag ? sidebar_module_css_default.gitSectionChevronExpanded : sidebar_module_css_default.gitSectionChevron }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tag") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitSectionCount,
												children: tagEntries.length
											})
										]
									})
								}),
								tagError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitError,
									children: tagError
								}),
								expandedSections.tag && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ElasticScroll, {
									id: `git-tag-entries-${viewId}`,
									className: sidebar_module_css_default.gitSectionBody,
									...scrollProps("tag"),
									children: [tagEntries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitEmpty,
										children: t("noChanges")
									}), tagEntries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitRow,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: sidebar_module_css_default.gitRowMain,
											title: `${entry.name}  ${entry.subject}`,
											onClick: (event) => {
												openTagMenu(event, entry);
											},
											onContextMenu: (event) => {
												openTagMenu(event, entry);
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitLogHash,
													children: entry.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitName,
													children: entry.subject
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: `${sidebar_module_css_default.gitTagState} ${entry.remoteState === "synced" ? sidebar_module_css_default.gitTagStateSynced : entry.remoteState === "local" ? sidebar_module_css_default.gitTagStateLocal : ""}`,
													children: t(entry.remoteState === "synced" ? "tagSynced" : entry.remoteState === "local" ? "tagLocal" : "tagSyncUnknown")
												})
											]
										})
									}, entry.name))]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${sidebar_module_css_default.gitSection} ${sidebar_module_css_default.gitSectionFlat} ${sidebar_module_css_default.gitSectionGrow}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: sidebar_module_css_default.gitSectionHeader,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: sidebar_module_css_default.gitSectionToggle,
											"aria-expanded": expandedSections.history,
											"aria-controls": `git-history-${viewId}`,
											onClick: () => {
												toggleSection("history");
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: expandedSections.history ? sidebar_module_css_default.gitSectionChevronExpanded : sidebar_module_css_default.gitSectionChevron }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("history") })]
										}),
										historyScrolled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `${sidebar_module_css_default.gitLink} ${sidebar_module_css_default.gitBackToTop}`,
											onClick: backToTop,
											children: t("backToTop")
										}),
										logEntries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${sidebar_module_css_default.gitSectionHint} ${historyScrolled ? sidebar_module_css_default.gitSectionHintAfterLink : ""}`,
											children: t("historyRecent", { count: logEntries.length })
										})
									]
								}),
								compareFrom !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: sidebar_module_css_default.gitCompareBar,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("comparePick", { hash: compareFrom.hash }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										onClick: () => {
											setCompareFrom(null);
										},
										children: t("cancel")
									})]
								}),
								expandedSections.history && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ElasticScroll, {
									id: `git-history-${viewId}`,
									className: `${sidebar_module_css_default.gitSectionBody} ${sidebar_module_css_default.gitSectionBodyHistory}`,
									"data-scroll-key": "history",
									onScroll: (event) => {
										const box = event.currentTarget;
										if (box.scrollTop <= 0) {
											if ((memory.scroll.history ?? 0) > 0) backToTop();
											return;
										}
										memory.scroll.history = box.scrollTop;
										setHistoryScrolled(box.scrollTop > box.clientHeight);
										if (box.scrollTop + box.clientHeight >= box.scrollHeight - LOAD_MORE_THRESHOLD) loadMoreLog();
									},
									children: [logEntries.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										role: "button",
										tabIndex: 0,
										className: sidebar_module_css_default.gitLogRow,
										title: `${refNames(entry.refs).join(" ")}\n${entry.author} · ${entry.date}\n${entry.hashFull}`.trimStart(),
										onClick: () => {
											pickHistoryRow(entry);
										},
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												pickHistoryRow(entry);
											}
										},
										onContextMenu: (event) => {
											openHistoryMenu(event, entry);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GraphCell, {
												row: graph.rows[index],
												lanes: graph.lanes
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogHash,
												children: entry.hash
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogSubject,
												children: entry.subject
											}),
											entry.refs !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
												label: refNames(entry.refs).join("\n"),
												side: "bottom",
												align: "end",
												portal: true,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitLogRefs,
													title: "",
													children: refNames(entry.refs).map((ref) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: sidebar_module_css_default.gitLogRef,
														style: { color: GRAPH_COLORS[graph.rows[index].lane % GRAPH_COLORS.length] },
														children: ref
													}, ref))
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogMeta,
												children: relativeTime(entry.date)
											})
										]
									}, entry.hashFull)), !logEnded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLogMore,
										disabled: logLoadingMore || busy,
										onClick: () => {
											loadMoreLog();
										},
										children: logLoadingMore ? t("loading") : t("loadMore")
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.gitCommit,
							style: commitInset === null ? void 0 : { paddingBottom: commitInset },
							children: [commitError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitCommitError,
								role: "alert",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.gitCommitErrorClose,
									"aria-label": t("close"),
									onClick: () => {
										setCommitError(null);
									},
									children: "×"
								}), checkoutBlocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("checkoutError") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("checkoutBlockedByChanges") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("errorDetails") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: sidebar_module_css_default.gitCommitErrorDetails,
										children: commitError
									})] })
								] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: sidebar_module_css_default.gitCommitErrorDetails,
									children: commitError
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitCommitCard,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: sidebar_module_css_default.gitCommitInput,
									rows: 1,
									"aria-label": t("commitPlaceholder"),
									placeholder: t("commitPlaceholder"),
									value: commitMsg,
									disabled: busy,
									onChange: (event) => {
										setCommitMsg(event.target.value);
										setCommitError(null);
									},
									onKeyDown: (event) => {
										if ((event.ctrlKey || event.metaKey) && event.key === "Enter") commit();
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: sidebar_module_css_default.gitCommitFooter,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitCommitHint,
										children: stagedEntries.length > 0 ? t("commitHint", { count: stagedEntries.length }) : t("commitHintEmpty")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitCommitButton,
										"aria-label": t("commit"),
										title: t("commit"),
										disabled: busy || commitMsg.trim() === "" || stagedEntries.length === 0,
										onClick: () => {
											commit();
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutlineRegular, { size: 16 })
									})]
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: fileMenu !== null,
							onClose: () => {
								setFileMenu(null);
							},
							items: [
								{
									id: "open",
									label: t("openEditor"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 })
								},
								fileMenu?.staged === true ? {
									id: "stage",
									label: t("unstage"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
								} : {
									id: "stage",
									label: t("stage"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 })
								},
								...fileMenu !== null && !isUntracked(fileMenu.entry) ? [{
									id: "discard",
									label: t("discard"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
									danger: true
								}] : [],
								{
									type: "separator",
									id: "sep1"
								},
								{
									id: "relative",
									label: t("copyRelative"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
								},
								{
									id: "absolute",
									label: t("copyAbsolute"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
								}
							],
							onSelect: (id) => {
								const target = fileMenu;
								if (target === null) return;
								setFileMenu(null);
								if (id === "open") {
									Promise.resolve().then(() => onOpenFile(target.entry.path)).catch((reason) => {
										setCommitError(reason instanceof Error ? reason.message : String(reason));
									});
									return;
								}
								if (id === "stage") {
									stageEntry(target.entry, target.staged);
									return;
								}
								if (id === "discard") {
									runConfirmed({
										...discardPrompt(target.entry),
										confirmLabel: t("discard"),
										onConfirm: () => api.gitDiscard(scope, target.entry.path)
									});
									return;
								}
								if (id === "relative") {
									copy(relativeTo(scope.cwd ?? "", target.entry.path));
									return;
								}
								if (id === "absolute") copy(target.entry.path);
							},
							portal: true,
							align: "start",
							anchorPoint: fileMenu === null ? void 0 : {
								x: fileMenu.x,
								y: fileMenu.y
							},
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: stashMenu !== null,
							onClose: () => {
								setStashMenu(null);
							},
							items: [
								{
									id: "pop",
									label: t("stashPop")
								},
								{
									id: "apply",
									label: t("stashApply")
								},
								{
									type: "separator",
									id: "sep3"
								},
								{
									id: "drop",
									label: t("stashDrop"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
									danger: true
								}
							],
							onSelect: (id) => {
								const target = stashMenu;
								if (target === null) return;
								setStashMenu(null);
								if (id === "pop") {
									runStashAction(() => api.gitStashPop(scope, target.entry.ref));
									return;
								}
								if (id === "apply") {
									runStashAction(() => api.gitStashApply(scope, target.entry.ref));
									return;
								}
								if (id === "drop") runConfirmed({
									title: t("stashDropTitle"),
									description: t("stashDropDesc", { ref: target.entry.ref }),
									confirmLabel: t("stashDrop"),
									onConfirm: () => api.gitStashDrop(scope, target.entry.ref)
								}, setStashError);
							},
							portal: true,
							align: "start",
							anchorPoint: stashMenu === null ? void 0 : {
								x: stashMenu.x,
								y: stashMenu.y
							},
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: tagMenu !== null,
							onClose: () => {
								setTagMenu(null);
							},
							items: [
								{
									id: "push",
									label: t("tagPush"),
									disabled: tagMenu?.entry.remoteState === "synced"
								},
								{
									id: "copy",
									label: t("tagCopyName"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
								},
								{
									type: "separator",
									id: "tag-separator"
								},
								{
									id: "delete",
									label: t("tagDelete"),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
									danger: true
								}
							],
							onSelect: (id) => {
								const target = tagMenu;
								if (target === null) return;
								setTagMenu(null);
								if (id === "copy") {
									copy(target.entry.name);
									return;
								}
								if (id === "push") {
									runConfirmed({
										title: t("tagPushTitle"),
										description: t("tagPushDesc", { name: target.entry.name }),
										confirmLabel: t("tagPush"),
										onConfirm: () => api.gitTagPush(scope, target.entry.name)
									}, setTagError);
									return;
								}
								if (id === "delete") runConfirmed({
									title: t("tagDeleteTitle"),
									description: t("tagDeleteDesc", { name: target.entry.name }),
									confirmLabel: t("tagDelete"),
									onConfirm: () => api.gitTagDelete(scope, target.entry.name)
								}, setTagError);
							},
							portal: true,
							align: "start",
							anchorPoint: tagMenu === null ? void 0 : {
								x: tagMenu.x,
								y: tagMenu.y
							},
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: historyMenu !== null,
							onClose: () => {
								setHistoryMenu(null);
							},
							items: (() => {
								const entry = historyMenu?.entry;
								const switchable = (entry === void 0 ? [] : localBranchesAt(entry)).filter((name) => name !== status?.branch);
								const deletable = switchable;
								return [
									{
										id: "view",
										label: t("viewCommitDiff")
									},
									{
										type: "separator",
										id: "sep-open"
									},
									{
										id: "checkout",
										label: t("checkoutBranch"),
										disabled: switchable.length === 0,
										submenu: switchable.map((name) => ({
											id: `checkout:${name}`,
											label: name
										}))
									},
									{
										id: "checkoutDetached",
										label: t("checkoutDetached")
									},
									{
										type: "separator",
										id: "sep-branch"
									},
									{
										id: "branchCreate",
										label: t("branchCreate")
									},
									{
										id: "branchDelete",
										label: t("branchDelete"),
										disabled: deletable.length === 0,
										submenu: deletable.map((name) => ({
											id: `delete:${name}`,
											label: name
										}))
									},
									{
										type: "separator",
										id: "sep-tag"
									},
									{
										id: "tag",
										label: t("tagCreateHere")
									},
									{
										type: "separator",
										id: "sep-pick"
									},
									{
										id: "cherryPick",
										label: t("cherryPickCommit")
									},
									{
										id: "revert",
										label: t("revertCommit"),
										danger: true
									},
									{
										type: "separator",
										id: "sep-compare"
									},
									{
										id: "compareRemote",
										label: t("compareRemote"),
										disabled: (status?.branch ?? "HEAD") === "HEAD"
									},
									{
										id: "compareMergeBase",
										label: t("compareMergeBase")
									},
									{
										id: "compareWith",
										label: t("compareWith")
									},
									{
										type: "separator",
										id: "sep-copy"
									},
									{
										id: "copyFull",
										label: t("copyFullHash")
									},
									{
										id: "copySubject",
										label: t("copySubject")
									},
									{
										type: "separator",
										id: "sep-chat"
									},
									{
										id: "addToChat",
										label: t("addToChat")
									},
									{
										id: "explain",
										label: t("explainCommit")
									}
								];
							})(),
							onSelect: (id) => {
								const target = historyMenu;
								if (target === null) return;
								setHistoryMenu(null);
								const entry = target.entry;
								if (id === "view") openCommitDiff(entry);
								if (id.startsWith("checkout:")) checkout(id.slice(9));
								if (id === "checkoutDetached") checkout(entry.hashFull);
								if (id === "branchCreate") {
									setBranchDraftError(null);
									setBranchDraft({
										commit: entry,
										name: ""
									});
								}
								if (id.startsWith("delete:")) {
									const name = id.slice(7);
									runConfirmed({
										title: t("branchDeleteTitle"),
										description: t("branchDeleteDesc", { name }),
										confirmLabel: t("branchDelete"),
										onConfirm: async () => {
											const { failed } = await api.gitBranchDelete(scope, [name]);
											if (failed.length > 0) throw new Error(failed[0].message);
										}
									});
								}
								if (id === "tag") {
									setTagDraftError(null);
									setTagDraft({
										commit: entry,
										name: "",
										message: ""
									});
								}
								if (id === "cherryPick") runConfirmed({
									title: t("cherryPickTitle"),
									description: t("cherryPickDesc", { subject: entry.subject }),
									confirmLabel: t("cherryPickCommit"),
									onConfirm: () => api.gitCherryPick(scope, entry.hashFull)
								});
								if (id === "revert") runConfirmed({
									title: t("revertTitle"),
									description: t("revertDesc", { subject: entry.subject }),
									confirmLabel: t("revertCommit"),
									onConfirm: () => api.gitRevert(scope, entry.hashFull)
								});
								if (id === "compareRemote") {
									const remote = `origin/${status?.branch ?? ""}`;
									openRangeDiff(remote, entry.hashFull, false, `${remote} ↔ ${entry.hash}`);
								}
								if (id === "compareMergeBase") openRangeDiff("HEAD", entry.hashFull, true, t("compareMergeBaseTitle", { hash: entry.hash }));
								if (id === "compareWith") setCompareFrom(entry);
								if (id === "copyFull") copy(entry.hashFull);
								if (id === "copySubject") copy(entry.subject);
								if (id === "addToChat") sendPrompt(t("addToChatText", {
									hash: entry.hashFull,
									subject: entry.subject
								}));
								if (id === "explain") sendPrompt(t("explainCommitText", {
									hash: entry.hashFull,
									subject: entry.subject
								}));
							},
							portal: true,
							align: "start",
							compact: true,
							anchorPoint: historyMenu === null ? void 0 : {
								x: historyMenu.x,
								y: historyMenu.y
							},
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
							open: confirm !== null,
							onClose: () => {
								setConfirm(null);
							},
							title: confirm?.title ?? "",
							closeLabel: t("cancel"),
							footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								onClick: () => {
									setConfirm(null);
								},
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: busy,
								onClick: () => {
									const pending = confirm;
									if (pending === null) return;
									setConfirm(null);
									pending.onConfirm();
								},
								children: confirm?.confirmLabel ?? ""
							})] }),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitConfirmDesc,
								children: confirm?.description
							})
						})
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: branchDraft !== null,
						onClose: () => {
							setBranchDraft(null);
						},
						title: t("branchCreateTitle"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setBranchDraft(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || (branchDraft?.name.trim() ?? "") === "",
							onClick: () => {
								createBranch();
							},
							children: t("branchCreateConfirm")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitConfirmDesc,
								children: branchDraft !== null && t("branchAtCommit", {
									hash: branchDraft.commit.hash,
									subject: branchDraft.commit.subject
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								placeholder: t("branchNamePlaceholder"),
								value: branchDraft?.name ?? "",
								disabled: busy,
								onChange: (event) => {
									setBranchDraft((draft) => draft === null ? draft : {
										...draft,
										name: event.target.value
									});
									setBranchDraftError(null);
								}
							}),
							branchDraftError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitError,
								children: branchDraftError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: tagDraft !== null,
						onClose: () => {
							setTagDraft(null);
						},
						title: t("tagCreateTitle"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setTagDraft(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || (tagDraft?.name.trim() ?? "") === "",
							onClick: () => {
								createTag();
							},
							children: t("tagCreate")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitConfirmDesc,
								children: tagDraft?.commit == null ? t("tagAtHead") : t("tagAtCommit", {
									hash: tagDraft.commit.hash,
									subject: tagDraft.commit.subject
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								placeholder: t("tagNamePlaceholder"),
								value: tagDraft?.name ?? "",
								disabled: busy,
								onChange: (event) => {
									setTagDraft((draft) => draft === null ? draft : {
										...draft,
										name: event.target.value
									});
									setTagDraftError(null);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								placeholder: t("tagMessagePlaceholder"),
								value: tagDraft?.message ?? "",
								disabled: busy,
								onChange: (event) => {
									setTagDraft((draft) => draft === null ? draft : {
										...draft,
										message: event.target.value
									});
									setTagDraftError(null);
								}
							}),
							tagDraftError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitError,
								children: tagDraftError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: mergeSource !== null,
						onClose: () => {
							setMergeSource(null);
						},
						title: t("mergeTitle"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setMergeSource(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || mergeSource === null,
							onClick: () => {
								const branch = mergeSource;
								if (branch === null) return;
								setMergeSource(null);
								merge(branch);
							},
							children: t("mergeBranch")
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: sidebar_module_css_default.gitConfirmDesc,
							children: t("mergeDesc", {
								source: mergeSource ?? "",
								current: status?.branch ?? ""
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.gitBranchFlow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: sidebar_module_css_default.gitBranchSelect,
									"aria-label": t("mergeTitle"),
									value: mergeSource ?? "",
									onChange: (event) => {
										setMergeSource(event.target.value);
									},
									children: branchNames.filter((name) => name !== status?.branch).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: name,
										children: name
									}, name))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "→"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									title: status?.branch ?? "",
									children: status?.branch
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: rebaseTarget !== null,
						onClose: () => {
							setRebaseTarget(null);
						},
						title: t("rebaseTitle"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setRebaseTarget(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || rebaseTarget === null,
							onClick: () => {
								const branch = rebaseTarget;
								if (branch === null) return;
								setRebaseTarget(null);
								rebase(branch);
							},
							children: t("rebaseBranch")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitConfirmDesc,
								children: t("rebaseDesc", {
									current: status?.branch ?? "",
									target: rebaseTarget ?? ""
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitBranchFlow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										title: status?.branch ?? "",
										children: status?.branch
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: "→"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: sidebar_module_css_default.gitBranchSelect,
										"aria-label": t("rebaseTitle"),
										value: rebaseTarget ?? "",
										onChange: (event) => {
											setRebaseTarget(event.target.value);
										},
										children: branchNames.filter((name) => name !== status?.branch).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitRebaseWarning,
								children: t("rebaseWarning")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: worktreeOpen,
						onClose: () => {
							setWorktreeOpen(false);
						},
						title: t("worktrees"),
						closeLabel: t("close"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setWorktreeOpen(false);
							},
							children: t("close")
						}),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
								className: sidebar_module_css_default.gitWorktreeCreate,
								onSubmit: (event) => {
									event.preventDefault();
									addWorktree();
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: sidebar_module_css_default.gitBranchSelect,
										"aria-label": t("worktreeBranch"),
										value: worktreeCreateNew ? "__new__" : worktreeBranch,
										disabled: busy,
										onChange: (event) => {
											const value = event.target.value;
											setWorktreeCreateNew(value === "__new__");
											if (value !== "__new__") setWorktreeBranch(value);
											setWorktreePath(`${worktreePathPrefix}${(value === "__new__" ? worktreeNewBranch || "new-branch" : value).replace(/[^\w.-]+/g, "-")}`);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "__new__",
											children: t("worktreeCreateBranch")
										}), branchNames.filter((name) => !worktrees.some((entry) => entry.branch === name)).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name))]
									}),
									worktreeCreateNew && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										value: worktreeNewBranch,
										"aria-label": t("worktreeNewBranch"),
										placeholder: t("worktreeNewBranch"),
										disabled: busy,
										onChange: (event) => {
											setWorktreeNewBranch(event.target.value);
											setWorktreePath(`${worktreePathPrefix}${(event.target.value || "new-branch").replace(/[^\w.-]+/g, "-")}`);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: sidebar_module_css_default.gitBranchSelect,
										"aria-label": t("worktreeBase"),
										value: worktreeBase,
										disabled: busy,
										onChange: (event) => {
											setWorktreeBase(event.target.value);
										},
										children: [worktreeBase !== "" && !branchNames.includes(worktreeBase) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: worktreeBase,
											children: worktreeBase
										}), branchNames.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name))]
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										value: worktreePath,
										"aria-label": t("worktreePath"),
										placeholder: t("worktreePathPlaceholder"),
										disabled: busy || (worktreeCreateNew ? worktreeNewBranch.trim() === "" : worktreeBranch === ""),
										onChange: (event) => {
											setWorktreePath(event.target.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										type: "submit",
										size: "sm",
										variant: "primary",
										disabled: busy || (worktreeCreateNew ? worktreeNewBranch.trim() === "" || worktreeBase === "" : worktreeBranch === "") || worktreePath.trim() === "",
										children: t("worktreeAdd")
									})
								]
							}),
							!worktreeCreateNew && worktreeBranch === "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitWorktreeHint,
								children: t("worktreeNoBranch")
							}),
							worktreeError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitError,
								children: worktreeError
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitWorktreeList,
								children: worktrees.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: sidebar_module_css_default.gitWorktreeRow,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: sidebar_module_css_default.gitWorktreeMain,
											disabled: busy || entry.prunable,
											title: t("worktreeOpenSession"),
											onClick: () => {
												openWorktree(entry.path);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: sidebar_module_css_default.gitWorktreeLine,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: sidebar_module_css_default.gitLogRef,
														children: entry.branch ?? t("worktreeDetached")
													}),
													entry.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: sidebar_module_css_default.gitWorktreeCurrent,
														children: t("worktreeCurrent")
													}),
													entry.locked && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: sidebar_module_css_default.gitWorktreeCurrent,
														children: t("worktreeLocked")
													})
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitWorktreePath,
												children: entry.path
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.iconButton,
											"aria-label": t("worktreeMerge"),
											title: t("worktreeMerge"),
											disabled: busy || entry.current || entry.branch === void 0 || operation !== null,
											onClick: () => {
												setWorktreeOpen(false);
												setWorktreeMerge(entry);
												setWorktreeTarget(worktrees.find((candidate) => candidate.current)?.path ?? "");
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.iconButton,
											"aria-label": t("worktreeRemove"),
											title: entry.current ? t("worktreeCurrentRemove") : t("worktreeRemove"),
											disabled: busy || entry.current || entry.locked,
											onClick: () => {
												setWorktreeOpen(false);
												runConfirmed({
													title: t("worktreeRemoveTitle"),
													description: t("worktreeRemoveDesc", { path: entry.path }),
													confirmLabel: t("worktreeRemove"),
													onConfirm: async () => {
														await onWorktreeRemoved((await api.gitWorktreeRemove(scope, entry.path)).path);
													}
												});
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
										})
									]
								}, entry.path))
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: worktreeMerge !== null,
						onClose: () => {
							setWorktreeMerge(null);
						},
						title: t("worktreeMergeTitle"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								onClick: () => {
									setWorktreeMerge(null);
								},
								children: t("cancel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								disabled: busy || worktreeTarget === "",
								onClick: () => {
									if (worktreeMerge !== null) mergeWorktree(worktreeMerge, true);
								},
								children: t("worktreeMergeRemove")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: busy || worktreeTarget === "",
								onClick: () => {
									if (worktreeMerge !== null) mergeWorktree(worktreeMerge, false);
								},
								children: t("worktreeMerge")
							})
						] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: sidebar_module_css_default.gitConfirmDesc,
							children: t("worktreeMergeDesc", {
								source: worktreeMerge?.branch ?? "",
								target: worktrees.find((entry) => entry.path === worktreeTarget)?.branch ?? ""
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: sidebar_module_css_default.gitBranchSelect,
							"aria-label": t("worktreeMergeTitle"),
							value: worktreeTarget,
							onChange: (event) => {
								setWorktreeTarget(event.target.value);
							},
							children: worktrees.filter((entry) => entry.path !== worktreeMerge?.path && entry.branch !== void 0 && !entry.prunable).map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: entry.path,
								children: entry.branch
							}, entry.path))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: branchManagerOpen,
						onClose: () => {
							setBranchManagerOpen(false);
						},
						title: t("branchManageTitle"),
						closeLabel: t("close"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setBranchManagerOpen(false);
							},
							children: t("close")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy || branchSelection.size === 0,
							onClick: deleteSelectedBranches,
							children: t("branchDeleteSelected", { count: branchSelection.size })
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitBranchTabs,
								children: ["local", "remote"].map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: branchTab === tab ? sidebar_module_css_default.gitBranchTabActive : sidebar_module_css_default.gitBranchTab,
									"aria-pressed": branchTab === tab,
									onClick: () => {
										setBranchTab(tab);
										setBranchSelection(/* @__PURE__ */ new Set());
									},
									children: t(tab === "local" ? "branchLocalTab" : "branchRemoteTab")
								}, tab))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitBranchTools,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy,
										onClick: () => {
											selectBranches((entry) => entry.merged);
										},
										children: t("branchSelectMerged")
									}),
									branchTab === "local" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy,
										onClick: () => {
											selectBranches((entry) => entry.gone);
										},
										children: t("branchSelectGone")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy || branchSelection.size === 0,
										onClick: () => {
											setBranchSelection(/* @__PURE__ */ new Set());
										},
										children: t("branchSelectNone")
									}),
									branchTab === "remote" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy || branchOverview?.remote === void 0,
										onClick: pruneRemoteBranches,
										children: t("branchPrune")
									})
								]
							}),
							branchTab === "local" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: sidebar_module_css_default.gitBranchForce,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: branchForce,
									disabled: busy,
									onChange: (event) => {
										setBranchForce(event.target.checked);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("branchForce") })]
							}),
							branchTab === "remote" && branchOverview !== null && branchOverview.remote === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: sidebar_module_css_default.gitWorktreeHint,
								children: t("branchNoRemote")
							}),
							branchManagerError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitError,
								children: branchManagerError
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitBranchList,
								children: [branchOverview !== null && branchRows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: sidebar_module_css_default.gitWorktreeHint,
									children: t("branchEmpty")
								}), branchRows.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: sidebar_module_css_default.gitBranchRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: branchSelection.has(entry.name),
										disabled: busy || entry.current,
										onChange: () => {
											setBranchSelection((current) => {
												const next = new Set(current);
												if (next.has(entry.name)) next.delete(entry.name);
												else next.add(entry.name);
												return next;
											});
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: sidebar_module_css_default.gitBranchRowMain,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: sidebar_module_css_default.gitBranchRowLine,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitBranchName,
													title: entry.name,
													children: entry.name
												}),
												entry.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitBranchBadge,
													children: t("branchCurrentBadge")
												}),
												entry.merged && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitBranchBadge,
													children: t("branchMerged")
												}),
												entry.gone && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitBranchBadgeWarn,
													children: t("branchGone")
												}),
												(entry.ahead > 0 || entry.behind > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: sidebar_module_css_default.gitBranchBadge,
													children: `↑${entry.ahead} ↓${entry.behind}`
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitWorktreePath,
											children: `${entry.date} ${entry.subject}`
										})]
									})]
								}, entry.name))]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/navigation.ts
		const PREFIX = "dsh-resource://git-diff/";
		/** Validate addresses restored from the sidebar or supplied by another plugin. */
		function parseDiffAddress(address) {
			if (!address.startsWith(PREFIX)) return void 0;
			try {
				const parts = address.slice(24).split("/");
				if (parts.length !== 2 || !parts[0] || !parts[1]) return void 0;
				const sessionId = decodeURIComponent(parts[0]);
				const value = JSON.parse(decodeURIComponent(parts[1]));
				if (value === null || typeof value !== "object") return void 0;
				const diff = value;
				if (diff.kind === "worktree" && typeof diff.path === "string" && diff.path !== "" && typeof diff.staged === "boolean" && (diff.untracked === void 0 || typeof diff.untracked === "boolean")) return {
					sessionId,
					diff: {
						kind: "worktree",
						path: diff.path,
						staged: diff.staged,
						untracked: diff.untracked
					}
				};
				if (diff.kind === "commit" && typeof diff.hashFull === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(diff.hashFull) && typeof diff.hash === "string" && typeof diff.subject === "string") return {
					sessionId,
					diff: {
						kind: "commit",
						hash: diff.hash,
						hashFull: diff.hashFull,
						subject: diff.subject
					}
				};
				if (diff.kind === "range" && typeof diff.from === "string" && diff.from !== "" && typeof diff.to === "string" && diff.to !== "" && typeof diff.mergeBase === "boolean" && typeof diff.title === "string") return {
					sessionId,
					diff: {
						kind: "range",
						from: diff.from,
						to: diff.to,
						mergeBase: diff.mergeBase,
						title: diff.title
					}
				};
				return;
			} catch {
				return;
			}
		}
		function diffTitle(diff) {
			if (diff.kind === "commit") return `${diff.hash} ${diff.subject}`;
			if (diff.kind === "range") return diff.title;
			return diff.path.split(/[\\/]/).at(-1);
		}
		//#endregion
		//#region node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region src/client/DiffView.tsx
		/**
		* The real diff surface for the git panel: parses the host's unified diff
		* text (`git diff` / `git show`) and renders it VSCode-style — per-file
		* sections with hunks (`@@ -a,b +c,d @@` headers), old/new line-number
		* gutters, and aligned context / deleted / added rows with source syntax
		* highlighting through DSH tokens. Untracked files produce no `git diff`
		* output, so the caller can pass their content as a full-file addition.
		*
		* The parser is a pure function (`parseUnifiedDiff`) so the interesting
		* cases are unit-tested without a DOM.
		*/
		function highlightedSide(rows, side, highlighter) {
			const result = /* @__PURE__ */ new Map();
			const hunks = /* @__PURE__ */ new Map();
			for (const row of rows) {
				const line = row.line?.[side];
				if (row.hunk === void 0 || line === void 0 || line === null) continue;
				if (!hunks.has(row.hunk)) hunks.set(row.hunk, []);
				hunks.get(row.hunk).push(line);
			}
			for (const lines of hunks.values()) {
				const spans = highlighter(lines.map((line) => line.text).join("\n"));
				if (spans !== void 0) lines.forEach((line, index) => {
					result.set(line, spans[index] ?? []);
				});
			}
			return result;
		}
		function DiffFileRows({ file, rows, renderRow }) {
			const path = displayPath(file.newPath === "/dev/null" ? file.oldPath : file.newPath);
			const highlighter = (0, _deepseek_ai_dsh_client_ui_primitives.useCodeHighlighter)((0, _deepseek_ai_dsh_client_ui_primitives.languageForPath)(path));
			const highlights = (0, react.useMemo)(() => ({
				old: highlightedSide(rows, "old", highlighter),
				new: highlightedSide(rows, "new", highlighter)
			}), [rows, highlighter]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: rows.map((row) => renderRow(row, highlights)) });
		}
		/** Parse the hunk header `@@ -a[,b] +c[,d] @@ section` (section may contain '@@'). */
		function parseHunkHeader(line) {
			const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
			if (match === null) return null;
			return {
				oldStart: Number(match[1]),
				newStart: Number(match[3]),
				header: match[5] ?? ""
			};
		}
		/**
		* Parse `git diff --no-color` output into file sections and hunks. Rows
		* outside a file section (leading noise) and metadata rows between the
		* `diff --git`/`---`/`+++` headers and the first hunk (index lines, mode
		* changes, rename/similarity lines) are skipped; a section that never
		* reaches a hunk (a mode/rename-only change) stays hunkless so the caller
		* can still draw its path.
		*/
		function parseUnifiedDiff(text) {
			const files = [];
			let current = null;
			let inHunk = false;
			let hunk = null;
			let oldNum = 0;
			let newNum = 0;
			const flushHunk = () => {
				if (current !== null && hunk !== null) current.hunks.push(hunk);
				hunk = null;
				inHunk = false;
			};
			for (const raw of text.split("\n")) {
				if (raw.startsWith("diff --git ")) {
					flushHunk();
					current = {
						oldPath: "",
						newPath: "",
						binary: false,
						hunks: []
					};
					files.push(current);
					continue;
				}
				if (current === null) continue;
				if (raw.startsWith("Binary files ") || raw === "GIT binary patch") {
					flushHunk();
					current.binary = true;
					continue;
				}
				if (raw.startsWith("--- ")) {
					flushHunk();
					current.oldPath = raw.slice(4);
					continue;
				}
				if (raw.startsWith("+++ ")) {
					current.newPath = raw.slice(4);
					continue;
				}
				const header = parseHunkHeader(raw);
				if (header !== null) {
					flushHunk();
					hunk = {
						oldStart: header.oldStart,
						newStart: header.newStart,
						header: header.header,
						lines: []
					};
					oldNum = header.oldStart;
					newNum = header.newStart;
					inHunk = true;
					continue;
				}
				if (!inHunk || hunk === null) continue;
				const marker = raw[0];
				if (marker === "\\") {
					hunk.lines.push({
						kind: "meta",
						text: raw.slice(1),
						oldNum: null,
						newNum: null
					});
					continue;
				}
				if (marker === " ") {
					hunk.lines.push({
						kind: "ctx",
						text: raw.slice(1),
						oldNum,
						newNum
					});
					oldNum += 1;
					newNum += 1;
				} else if (marker === "-") {
					hunk.lines.push({
						kind: "del",
						text: raw.slice(1),
						oldNum,
						newNum: null
					});
					oldNum += 1;
				} else if (marker === "+") {
					hunk.lines.push({
						kind: "add",
						text: raw.slice(1),
						oldNum: null,
						newNum
					});
					newNum += 1;
				} else flushHunk();
			}
			flushHunk();
			return { files };
		}
		/** Align each contiguous delete/add block into old/new rows for split display. */
		function alignDiffLines(lines) {
			const rows = [];
			let deleted = [];
			let added = [];
			const flush = () => {
				for (let index = 0; index < Math.max(deleted.length, added.length); index += 1) rows.push({
					old: deleted[index] ?? null,
					new: added[index] ?? null
				});
				deleted = [];
				added = [];
			};
			for (const line of lines) if (line.kind === "del") {
				if (added.length > 0) flush();
				deleted.push(line);
			} else if (line.kind === "add") added.push(line);
			else {
				flush();
				if (line.kind === "meta") rows.push({
					old: null,
					new: null,
					meta: line.text
				});
				else rows.push({
					old: line,
					new: line
				});
			}
			flush();
			return rows;
		}
		/** Build the untracked-file shape: one file, one hunk of pure additions. */
		function untrackedFile(path, content) {
			const lines = [];
			const body = content.endsWith("\n") ? content.slice(0, -1) : content;
			if (body !== "") {
				let num = 1;
				for (const line of body.split("\n")) {
					lines.push({
						kind: "add",
						text: line,
						oldNum: null,
						newNum: num
					});
					num += 1;
				}
			}
			return {
				oldPath: "/dev/null",
				newPath: `b/${path}`,
				binary: false,
				hunks: [{
					oldStart: 0,
					newStart: 1,
					header: "",
					lines
				}]
			};
		}
		/** Strip the `a/` / `b/` prefix git puts on diff paths (not on /dev/null). */
		function displayPath(path) {
			if (path === "/dev/null") return path;
			if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
			return path;
		}
		/** The file header badge: added / deleted / renamed / binary ('' for a plain edit). */
		function fileTag(file) {
			if (file.binary) return t("diffBinary");
			if (file.oldPath === "/dev/null") return t("diffAdded");
			if (file.newPath === "/dev/null") return t("diffDeleted");
			if (displayPath(file.oldPath) !== displayPath(file.newPath)) return t("diffRenamed");
			return null;
		}
		/** Cap the flattened rows like DiffBlock: head + tail, expand button between. */
		const MAX_DIFF_ROWS = 500;
		const TEST_PATH = /(^|\/)(?:__tests__|tests?|specs?|fixtures?|mocks?|snapshots?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i;
		const DOC_PATH = /(^|\/)(?:docs?|documentation)(?:\/|$)|(^|\/)(?:readme|changelog|contributing|license|authors|notice)(?:\.[^/]*)?$/i;
		const GENERATED_PATH = /(^|\/)(?:dist|build|coverage|generated|vendor|node_modules)(?:\/|$)|(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|composer\.lock|cargo\.lock|poetry\.lock)$/i;
		const SOURCE_PATH = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|py|pyw|rb|php|java|kt|kts|scala|go|rs|swift|c|h|cc|cpp|cxx|hpp|hh|hxx|cs|fs|fsx|vb|dart|lua|r|ex|exs|erl|hrl|clj|cljs|cljc|groovy|sh|bash|zsh|fish|ps1|sql|vue|svelte|astro|html|htm|css|scss|sass|less)$/i;
		/** Source files open by default; tests, docs, generated files and unknown types stay folded. */
		function defaultExpandedFiles(files) {
			const expanded = /* @__PURE__ */ new Set();
			files.forEach((file, index) => {
				const path = displayPath(file.newPath === "/dev/null" ? file.oldPath : file.newPath);
				if (!file.binary && file.hunks.length > 0 && !TEST_PATH.test(path) && !DOC_PATH.test(path) && !GENERATED_PATH.test(path) && SOURCE_PATH.test(path)) expanded.add(index);
			});
			return expanded;
		}
		function DiffView({ diff, untrackedPath, untrackedContent }) {
			const parsed = (0, react.useMemo)(() => {
				if (untrackedPath !== void 0) return { files: [untrackedFile(untrackedPath, untrackedContent ?? "")] };
				return parseUnifiedDiff(diff);
			}, [
				diff,
				untrackedPath,
				untrackedContent
			]);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [expandedFiles, setExpandedFiles] = (0, react.useState)(() => defaultExpandedFiles(parsed.files));
			(0, react.useEffect)(() => {
				setExpandedFiles(defaultExpandedFiles(parsed.files));
			}, [parsed]);
			const rows = (0, react.useMemo)(() => {
				const out = [];
				parsed.files.forEach((file, fileIndex) => {
					out.push({
						key: `f${fileIndex}`,
						file,
						fileIndex,
						type: "path"
					});
					if (file.binary || !expandedFiles.has(fileIndex)) return;
					file.hunks.forEach((hunk, hunkIndex) => {
						out.push({
							key: `f${fileIndex}h${hunkIndex}`,
							file,
							fileIndex,
							type: "hunk",
							hunk
						});
						alignDiffLines(hunk.lines).forEach((line, lineIndex) => {
							out.push({
								key: `f${fileIndex}h${hunkIndex}l${lineIndex}`,
								file,
								fileIndex,
								type: "line",
								hunk,
								line
							});
						});
					});
				});
				return out;
			}, [parsed, expandedFiles]);
			const hidden = rows.length - MAX_DIFF_ROWS;
			const capped = hidden > 0 && !expanded;
			const headLines = Math.ceil(MAX_DIFF_ROWS / 2);
			const tailLines = 250;
			const head = capped ? rows.slice(0, headLines) : rows;
			const tail = capped ? rows.slice(rows.length - tailLines) : [];
			if (rows.length === 0) return null;
			const renderRow = (row, highlights) => {
				if (row.type === "path") {
					const tag = fileTag(row.file);
					const from = displayPath(row.file.oldPath);
					const to = displayPath(row.file.newPath);
					const expandable = !row.file.binary && row.file.hunks.length > 0;
					const fileExpanded = expandedFiles.has(row.fileIndex);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: sidebar_module_css_default.gitDiffFile,
						disabled: !expandable,
						"aria-expanded": expandable ? fileExpanded : void 0,
						onClick: () => {
							setExpandedFiles((current) => {
								const next = new Set(current);
								if (next.has(row.fileIndex)) next.delete(row.fileIndex);
								else next.add(row.fileIndex);
								return next;
							});
						},
						children: [
							expandable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								className: clsx(sidebar_module_css_default.gitDiffFileChevron, fileExpanded && sidebar_module_css_default.gitDiffFileChevronExpanded),
								children: "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitDiffFilePath,
								children: to
							}),
							from !== to && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: sidebar_module_css_default.gitDiffFileOld,
								children: ["← ", from]
							}),
							tag !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitDiffFileTag,
								children: tag
							})
						]
					}, row.key);
				}
				if (row.type === "hunk") {
					const hunk = row.hunk;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitDiffHunk,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidebar_module_css_default.gitDiffHunkHeader,
							children: [
								"@@ -",
								hunk.oldStart,
								",",
								hunk.lines.filter((l) => l.oldNum !== null).length,
								" +",
								hunk.newStart,
								",",
								hunk.lines.filter((l) => l.newNum !== null).length,
								" @@"
							]
						}), hunk.header !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffHunkSection,
							children: hunk.header
						})]
					}, row.key);
				}
				const line = row.line;
				if (line.meta !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.gitDiffMeta,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.gitDiffMetaText,
						children: line.meta
					})
				}, row.key);
				const renderSide = (side) => {
					const value = line[side];
					const spans = value === null ? void 0 : highlights[side].get(value);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: clsx(sidebar_module_css_default.gitDiffSide, value?.kind === "del" && sidebar_module_css_default.gitDiffDel, value?.kind === "add" && sidebar_module_css_default.gitDiffAdd),
						children: value !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffNum,
							children: side === "old" ? value.oldNum : value.newNum
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: sidebar_module_css_default.gitDiffCode,
							children: spans !== void 0 ? spans.map((span, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: span.style,
								children: span.text
							}, index)) : value.text
						})] })
					});
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.gitDiffLine,
					children: [renderSide("old"), renderSide("new")]
				}, row.key);
			};
			const renderVisibleRows = (visible, part) => {
				const byFile = /* @__PURE__ */ new Map();
				for (const row of visible) {
					if (!byFile.has(row.fileIndex)) byFile.set(row.fileIndex, []);
					byFile.get(row.fileIndex).push(row);
				}
				return [...byFile].map(([index, fileRows]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffFileRows, {
					file: fileRows[0].file,
					rows: fileRows,
					renderRow
				}, `${part}:${index}`));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.gitDiff,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.gitDiffBody,
					children: [
						renderVisibleRows(head, "head"),
						hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.gitDiffExpand,
							"aria-expanded": expanded,
							onClick: () => {
								setExpanded((value) => !value);
							},
							children: expanded ? t("diffCollapse") : t("diffExpand", { count: hidden })
						}),
						renderVisibleRows(tail, "tail")
					]
				})
			});
		}
		//#endregion
		//#region src/client/DiffTab.tsx
		/**
		* The diff content: one change opened from the git panel, like VSCode's diff
		* editor. A worktree ref loads the file's unified diff (`git diff`, staged or
		* not; untracked files — which git diff never covers — render as a full-file
		* addition from their content), a commit ref loads the commit's full patch
		* (`git.show`-style). The header carries a refresh button because staging or
		* discarding can change the content while it is open.
		*/
		function DiffTab(props) {
			const { sessionId, cwd, diff } = props;
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [data, setData] = (0, react.useState)(null);
			const [tick, setTick] = (0, react.useState)(0);
			const refresh = (0, react.useCallback)(() => {
				setTick((value) => value + 1);
			}, []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const scope = {
					sessionId,
					cwd
				};
				setLoading(true);
				setError(null);
				setData(null);
				const load = async () => {
					try {
						if (diff.kind === "commit") {
							const result = await api.gitCommitDiff(scope, diff.hashFull);
							if (!cancelled) setData({ diff: result.diff });
							return;
						}
						if (diff.kind === "range") {
							const result = await api.gitRangeDiff(scope, diff.from, diff.to, diff.mergeBase);
							if (!cancelled) setData({ diff: result.diff });
							return;
						}
						let result = await api.gitDiff(scope, diff.path, diff.staged);
						if (result.diff === "") {
							const other = await api.gitDiff(scope, diff.path, !diff.staged);
							if (other.diff !== "") result = other;
						}
						if (result.diff !== "") {
							if (!cancelled) setData({ diff: result.diff });
							return;
						}
						if (diff.untracked === true && !diff.staged) {
							const text = await api.fsRead(scope, diff.path);
							if (!cancelled) setData(text.kind === "text" ? {
								diff: "",
								untracked: text.content
							} : { diff: "" });
							return;
						}
						if (!cancelled) setData({ diff: "" });
					} catch (reason) {
						if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
					} finally {
						if (!cancelled) setLoading(false);
					}
				};
				load();
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				cwd,
				diff,
				tick
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.gitDiffTab,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitDiffTabHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffTabTitle,
							title: diff.kind === "worktree" ? diff.path : diffTitle(diff),
							children: diff.kind === "worktree" ? diff.path : diffTitle(diff)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("refresh"),
							title: t("refresh"),
							onClick: refresh,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
						})]
					}),
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!loading && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitError,
						children: [
							t("diffLoadError"),
							": ",
							error
						]
					}),
					!loading && error === null && data !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [data.untracked !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, {
						diff: "",
						untrackedPath: diff.kind === "worktree" ? diff.path : "",
						untrackedContent: data.untracked
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, { diff: data.diff }), data.diff === "" && data.untracked === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitEmpty,
						children: t("diffEmpty")
					})] })
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** Register Git and per-change diff tabs with the built-in right sidebar. */
		const inject = [
			"slots",
			"locale",
			"sidebarRightTabs",
			"sessions",
			"workspaces",
			"uiWorkspace"
		];
		function sessionDirectory(session) {
			const values = session?.projectionValues;
			return values !== void 0 && "workingDirectory" in values && typeof values.workingDirectory === "string" ? values.workingDirectory : session?.cwd;
		}
		/** Mount independent views; every registration is released on plugin unload. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NS, {
				zh,
				en
			}));
			ctx.effect(() => {
				attachLocale(ctx.locale);
				return () => {
					attachLocale(void 0);
				};
			});
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: "dsh-git-sidebar",
				kind: "dsh-git",
				title: () => t("git"),
				guide: [{
					id: "git",
					order: 20,
					title: () => t("git"),
					description: () => t("gitGuideDesc"),
					icon: _deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular
				}]
			}));
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: "dsh-git-sidebar/diff",
				kind: "dsh-git-diff",
				patterns: ["dsh-resource://git-diff/**"],
				canOpen: (address) => parseDiffAddress(address) !== void 0,
				title: (address) => diffTitle(parseDiffAddress(address).diff)
			}));
			const useLanguage = () => (0, react.useSyncExternalStore)((listener) => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot().active);
			function GitBody({ sessionId, useSessions, useTabInfo }) {
				useLanguage();
				const cwd = useSessions((state) => sessionDirectory(state.byId[sessionId]));
				const { tab } = useTabInfo();
				const [openDiff, setOpenDiff] = (0, react.useState)(null);
				const scope = {
					sessionId,
					cwd
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitView, {
					scope,
					onOpenDiff: (seed) => {
						if (seed.diff !== void 0) setOpenDiff(seed.diff);
					},
					onOpenFile: async (path) => {
						const result = await api.gitPath(scope, path);
						tab.actions.openResource(sessionFileAddress(sessionId, result.path));
					},
					onPrompt: async (text) => {
						const scoped = ctx.sessions.scope(sessionId);
						const session = scoped === void 0 ? void 0 : ctx.sessions.sessionOf(scoped);
						if (session === void 0) throw new Error("session unavailable");
						const handle = session.beginSubmission({
							mode: "queue",
							text,
							attachments: []
						});
						const result = await session.prompt([{
							type: "text",
							text
						}], "queue", void 0, handle.requestId);
						if (!result.ok) throw new Error(result.error.message);
					},
					onOpenWorktree: async (path) => {
						const workspace = await ctx.workspaces.create({ path });
						const { byId } = ctx.sessions.list.getSnapshot();
						const existing = workspace.sessionIds.find((id) => byId[id]?.origin !== "subagent");
						if (existing !== void 0) {
							ctx.uiWorkspace.openSession(existing);
							return;
						}
						const id = await ctx.sessions.create({ workspaceId: workspace.workspaceId });
						ctx.uiWorkspace.openSession(id);
					},
					onWorktreeRemoved: async (path) => {
						const workspace = ctx.workspaces.list.getSnapshot().items.find((item) => item.path === path);
						if (workspace !== void 0) await ctx.workspaces.delete(workspace.workspaceId);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: openDiff !== null,
					onClose: () => {
						setOpenDiff(null);
					},
					title: t("viewDiff"),
					closeLabel: t("close"),
					className: sidebar_module_css_default.gitDiffModal,
					contentClassName: sidebar_module_css_default.gitDiffModalContent,
					children: openDiff !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffTab, {
						sessionId,
						cwd,
						diff: openDiff
					})
				})] });
			}
			function DiffBody({ sessionId, useSessions, useTabInfo }) {
				useLanguage();
				const cwd = useSessions((state) => sessionDirectory(state.byId[sessionId]));
				const { tab } = useTabInfo();
				const value = (0, react.useMemo)(() => parseDiffAddress(tab.navigation.address), [tab.navigation.address]);
				if (value === void 0 || value.sessionId !== sessionId) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("diffLoadError") });
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffTab, {
					sessionId,
					cwd,
					diff: value.diff
				});
			}
			ctx.effect(() => {
				const mainByPath = /* @__PURE__ */ new Map();
				const checking = /* @__PURE__ */ new Set();
				const rowSelector = "[data-row-key^=\"workspace:\"]";
				let live = true;
				const folded = /* @__PURE__ */ new Set();
				const clearNesting = (section) => {
					if (section.hasAttribute("data-git-worktree-child")) section.hidden = false;
					section.removeAttribute("data-git-worktree-child");
					section.removeAttribute("data-git-worktree-open");
					section.removeAttribute("data-git-worktree-last");
					section.style.removeProperty("order");
				};
				const nest = (sectionById, pathById, idByPath) => {
					const nested = /* @__PURE__ */ new Set();
					const worktreesOf = /* @__PURE__ */ new Map();
					for (const [id, section] of sectionById) {
						const main = mainByPath.get(pathById.get(id));
						const parent = typeof main === "string" ? sectionById.get(idByPath.get(main) ?? "") : void 0;
						if (parent === void 0 || parent.parentElement !== section.parentElement) {
							clearNesting(section);
							continue;
						}
						section.setAttribute("data-git-worktree-child", "");
						section.style.order = String(2 * [...parent.parentElement.children].indexOf(parent) + 1);
						nested.add(parent.parentElement);
						worktreesOf.set(parent, [...worktreesOf.get(parent) ?? [], section]);
					}
					for (const [parent, worktrees] of worktreesOf) {
						const row = parent.querySelector(rowSelector);
						const key = row.dataset.rowKey;
						if (!folded.has(key)) {
							folded.add(key);
							if (row.getAttribute("aria-expanded") === "true") row.click();
						}
						const open = row.getAttribute("aria-expanded") !== "false";
						parent.toggleAttribute("data-git-worktree-open", open);
						worktrees.forEach((section, index) => {
							section.hidden = !open;
							section.toggleAttribute("data-git-worktree-last", index === worktrees.length - 1);
						});
					}
					for (const tree of document.querySelectorAll("[data-git-worktree-tree]")) {
						if (nested.has(tree)) continue;
						tree.removeAttribute("data-git-worktree-tree");
						for (const section of tree.children) if (section instanceof HTMLElement) clearNesting(section);
					}
					for (const tree of nested) {
						tree.setAttribute("data-git-worktree-tree", "");
						[...tree.children].forEach((section, index) => {
							if (section instanceof HTMLElement && !section.hasAttribute("data-git-worktree-child")) section.style.order = String(2 * index);
						});
					}
				};
				const sync = () => {
					const workspaces = ctx.workspaces.list.getSnapshot().items;
					const pathById = new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace.path]));
					const idByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace.workspaceId]));
					const sectionById = /* @__PURE__ */ new Map();
					for (const row of document.querySelectorAll(rowSelector)) {
						const id = row.dataset.rowKey.slice(10);
						const section = row.closest("[role=\"tree\"] > *");
						if (section !== null && section.querySelector(rowSelector) === row && pathById.has(id)) sectionById.set(id, section);
						const folder = row.firstElementChild;
						if (!(folder instanceof HTMLElement)) continue;
						const path = pathById.get(id);
						if (path !== void 0 && typeof mainByPath.get(path) === "string") {
							folder.setAttribute("data-git-worktree-folder", "");
							folder.setAttribute("role", "img");
							folder.setAttribute("aria-label", t("worktreeMark"));
							folder.setAttribute("title", t("worktreeMark"));
						} else if (folder.hasAttribute("data-git-worktree-folder")) {
							folder.removeAttribute("data-git-worktree-folder");
							folder.removeAttribute("role");
							folder.removeAttribute("aria-label");
							folder.removeAttribute("title");
						}
					}
					nest(sectionById, pathById, idByPath);
					for (const { path } of workspaces) {
						if (mainByPath.has(path) || checking.has(path)) continue;
						checking.add(path);
						api.gitWorktreeLinked(path).then(({ main }) => {
							mainByPath.set(path, main ?? null);
						}, () => {
							mainByPath.set(path, null);
						}).finally(() => {
							checking.delete(path);
							if (live) sync();
						});
					}
				};
				const observer = new MutationObserver((records) => {
					if (records.some((record) => record.target instanceof Element && record.target.closest(rowSelector) !== null || [...record.addedNodes].some((node) => node instanceof Element && (node.matches(rowSelector) || node.querySelector(rowSelector) !== null)))) sync();
				});
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["aria-expanded"]
				});
				const unsubscribeWorkspaces = ctx.workspaces.list.subscribe(sync);
				const unsubscribeLocale = ctx.locale.subscribe(sync);
				sync();
				return () => {
					live = false;
					observer.disconnect();
					unsubscribeWorkspaces();
					unsubscribeLocale();
					nest(/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map());
					for (const folder of document.querySelectorAll("[data-git-worktree-folder]")) {
						folder.removeAttribute("data-git-worktree-folder");
						folder.removeAttribute("role");
						folder.removeAttribute("aria-label");
						folder.removeAttribute("title");
					}
				};
			});
			function GitTitle() {
				useLanguage();
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 16 }),
					" ",
					t("git")
				] });
			}
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: "dsh-git-sidebar"
			}, GitBody)));
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: "dsh-git-sidebar/diff"
			}, DiffBody)));
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: "dsh-git-sidebar"
			}, GitTitle)));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
import { open, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import Schema from "schemastery";
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
const remoteTagCache = /* @__PURE__ */ new Map();
/** One git failure (stderr text as the message). */
var GitCommandError = class extends Error {
	code;
	command;
	constructor(message, code = "git-error", command) {
		super(message);
		this.code = code;
		this.command = command;
	}
};
/** Parse porcelain v1 -z output into entries (rename/copy pairs collapse to one row). */
function parsePorcelainZ(output) {
	const tokens = output.split("\0");
	const entries = [];
	let index = 0;
	while (index < tokens.length) {
		const token = tokens[index];
		index += 1;
		if (token === "") continue;
		const xy = token.slice(0, 2);
		const rest = token.slice(3);
		entries.push({
			path: rest,
			xy
		});
		if ((xy[0] === "R" || xy[0] === "C") && tokens[index] !== void 0 && tokens[index] !== "") index += 1;
	}
	return entries;
}
/** Parse `git log --pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D%x1f%P` rows. */
function parseLogLines(output) {
	const rows = [];
	for (const line of output.split("\n")) {
		if (line === "") continue;
		const [hash, subject, author, date, hashFull, refs, parents] = line.split("");
		if (hash === void 0 || subject === void 0) continue;
		rows.push({
			hash,
			subject,
			author: author ?? "",
			date: date ?? "",
			hashFull: hashFull ?? hash,
			refs: refs ?? "",
			parents: (parents ?? "").split(" ").filter((part) => part !== "")
		});
	}
	return rows;
}
/** Parse NUL-framed worktree porcelain without depending on paths being newline-free. */
function parseWorktreePorcelainZ(output) {
	const entries = [];
	let entry;
	for (const field of output.split("\0")) {
		if (field === "") {
			if (entry !== void 0) entries.push(entry);
			entry = void 0;
			continue;
		}
		const at = field.indexOf(" ");
		const key = at === -1 ? field : field.slice(0, at);
		const value = at === -1 ? "" : field.slice(at + 1);
		if (key === "worktree") entry = {
			path: value,
			head: "",
			current: false,
			locked: false,
			prunable: false
		};
		else if (entry !== void 0 && key === "HEAD") entry.head = value;
		else if (entry !== void 0 && key === "branch") entry.branch = value.replace(/^refs\/heads\//, "");
		else if (entry !== void 0 && key === "locked") entry.locked = true;
		else if (entry !== void 0 && key === "prunable") entry.prunable = true;
	}
	return entries;
}
/** Run one git command; resolves with stdout, rejects with GitCommandError. */
function runGit(cwd, args, timeoutMs = 3e4) {
	const full = [
		"-C",
		cwd,
		"--no-pager",
		"-c",
		"color.ui=false",
		...args
	];
	return new Promise((resolvePromise, reject) => {
		const child = spawn("git", full, {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			env: {
				...process.env,
				GIT_OPTIONAL_LOCKS: "0"
			}
		});
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new GitCommandError(`git ${args[0] ?? ""} timed out after ${timeoutMs}ms`, "git-error", args.join(" ")));
		}, timeoutMs);
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(new GitCommandError(`cannot run git: ${error.message}`, "git-error", args.join(" ")));
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) resolvePromise(stdout);
			else reject(new GitCommandError(stderr.trim() || `git exited with ${String(code)}`, "git-error", args.join(" ")));
		});
	});
}
/** Whether the directory is inside a git work tree (exit-0 `git rev-parse`). */
async function isGitRepo(cwd) {
	try {
		return (await runGit(cwd, ["rev-parse", "--is-inside-work-tree"])).trim() === "true";
	} catch {
		return false;
	}
}
/** The repository top level containing `cwd` (`git rev-parse --show-toplevel`). */
async function repoRoot(cwd) {
	return (await runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();
}
/** The current branch name (`git rev-parse --abbrev-ref HEAD`; 'HEAD' when detached). */
async function currentBranch(cwd) {
	return (await runGit(cwd, [
		"rev-parse",
		"--abbrev-ref",
		"HEAD"
	])).trim();
}
/** Working-tree status (untracked included). */
async function status(cwd) {
	if (!await isGitRepo(cwd)) return {
		isRepo: false,
		ahead: 0,
		behind: 0,
		entries: []
	};
	const [branch, raw, [behind, ahead]] = await Promise.all([
		currentBranch(cwd).catch(() => "HEAD"),
		runGit(cwd, [
			"status",
			"--porcelain=v1",
			"-z",
			"--untracked-files=normal"
		]),
		runGit(cwd, [
			"rev-list",
			"--left-right",
			"--count",
			"@{upstream}...HEAD"
		]).then((value) => {
			const [left = 0, right = 0] = value.trim().split(/\s+/).map(Number);
			return [left, right];
		}).catch(() => [0, 0])
	]);
	return {
		isRepo: true,
		branch,
		ahead,
		behind,
		entries: parsePorcelainZ(raw)
	};
}
/** Fetch the current remote, or every configured remote. */
async function fetchRemote(cwd, all = false) {
	await runGit(cwd, ["fetch", ...all ? ["--all"] : []], 12e4);
}
/** Push the current branch to its configured upstream. */
async function push(cwd) {
	await runGit(cwd, ["push"], 12e4);
}
/** Diff text of the worktree (unstaged) or the index (staged). */
async function diff(cwd, path, staged) {
	const args = [
		"diff",
		"--no-ext-diff",
		"--no-color",
		"-U3"
	];
	if (staged) args.push("--cached");
	if (path !== void 0) args.push("--", path);
	return runGit(cwd, args);
}
/** Stage paths (all when path is undefined). */
async function stage(cwd, path) {
	await runGit(cwd, [
		"add",
		"-A",
		...path !== void 0 ? ["--", path] : []
	]);
}
/** Unstage paths (all when path is undefined). */
async function unstage(cwd, path) {
	await runGit(cwd, [
		"reset",
		"-q",
		...path !== void 0 ? ["--", path] : []
	]);
}
/**
* Push every change onto the stash stack. Untracked files are included so the
* panel's three change groups all clear together — leaving them behind makes
* the button look like it did nothing.
*/
async function stash(cwd) {
	await runGit(cwd, [
		"stash",
		"push",
		"--include-untracked"
	]);
}
/** The stash stack, newest (stash@{0}) first; [] when empty. */
async function stashList(cwd) {
	return (await runGit(cwd, [
		"stash",
		"list",
		"-z",
		"--format=%gd%x1f%s"
	])).split("\0").filter((row) => row !== "").map((row) => {
		const [ref, message] = row.split("");
		return {
			ref: ref ?? "",
			message: message ?? ""
		};
	});
}
/** Restore one stash entry and remove it from the stack. */
async function stashPop(cwd, ref) {
	await runGit(cwd, [
		"stash",
		"pop",
		ref
	]);
}
/** Restore one stash entry, keeping it on the stack. */
async function stashApply(cwd, ref) {
	await runGit(cwd, [
		"stash",
		"apply",
		ref
	]);
}
/** Discard one stash entry (not recoverable). */
async function stashDrop(cwd, ref) {
	await runGit(cwd, [
		"stash",
		"drop",
		ref
	]);
}
/** Commit the staged changes with a message (global identity untouched). */
async function commit(cwd, message) {
	await runGit(cwd, [
		"commit",
		"-m",
		message
	]);
}
/** Stage everything (untracked included) and commit it as a throwaway "WIP" commit. */
async function wipCommit(cwd) {
	await runGit(cwd, ["add", "-A"]);
	await runGit(cwd, [
		"commit",
		"-q",
		"-m",
		"WIP"
	]);
}
/**
* Drop the WIP commit at HEAD and put its changes back into the working tree
* (mixed reset, so they show up unstaged like before the WIP commit). Refuses
* when HEAD is not a WIP commit so a real commit can never be reset by accident.
*/
async function wipUndo(cwd) {
	if ((await runGit(cwd, [
		"log",
		"-1",
		"--format=%s"
	])).trim() !== "WIP") throw new GitCommandError("HEAD is not a WIP commit", "git-error", "wip-undo");
	if (await runGit(cwd, [
		"merge-base",
		"--is-ancestor",
		"HEAD",
		"@{upstream}"
	]).then(() => true, () => false)) throw new GitCommandError("WIP commit was already pushed; undo it from a terminal", "git-error", "wip-undo");
	await runGit(cwd, [
		"reset",
		"-q",
		"HEAD~1"
	]);
}
/**
* Move the branch back to its upstream (`git reset @{upstream}`, mixed): every
* unpushed commit is unwound into the working tree, no file content is lost.
* Refuses when the branch is behind so that fetched remote commits can never be
* pulled in through a reset. Needs a configured upstream.
*/
async function resetToUpstream(cwd) {
	const [behind = 0, ahead = 0] = (await runGit(cwd, [
		"rev-list",
		"--left-right",
		"--count",
		"@{upstream}...HEAD"
	])).trim().split(/\s+/).map(Number);
	if (behind > 0) throw new GitCommandError("branch is behind its upstream; fetch and merge first", "git-error", "reset-to-upstream");
	if (ahead === 0) return;
	await runGit(cwd, [
		"reset",
		"-q",
		"@{upstream}"
	]);
}
/** Local branch names by latest commit time (newest first). */
async function branches(cwd) {
	const [current, raw] = await Promise.all([currentBranch(cwd).catch(() => "HEAD"), runGit(cwd, [
		"for-each-ref",
		"--sort=-committerdate",
		"--format=%(refname:strip=2)",
		"refs/heads"
	])]);
	const names = raw.split("\n").filter((line) => line !== "");
	return {
		current,
		names: names.includes(current) ? names : [current, ...names]
	};
}
/** Switch to an existing branch. */
async function checkout(cwd, branch) {
	await runGit(cwd, ["checkout", branch]);
}
/** Create a branch at a commit without switching to it. */
async function branchCreate(cwd, name, commit) {
	await runGit(cwd, [
		"branch",
		name,
		commit
	]);
}
/**
* Delete local branches (`-d`; `force` switches to `-D`, which also drops
* unmerged commits). One branch per call so a batch reports exactly which
* names failed instead of stopping at the first one.
*/
async function branchDelete(cwd, names, force = false) {
	const failures = [];
	for (const name of names) try {
		await runGit(cwd, [
			"branch",
			force ? "-D" : "-d",
			name
		]);
	} catch (error) {
		failures.push({
			name,
			message: error instanceof Error ? error.message : String(error)
		});
	}
	return failures;
}
/**
* Delete branches on their remote (`git push <remote> --delete <branch>`).
* Each ref carries its remote as the first path segment, the way the panel
* lists it (`origin/feature`), so no remote has to be passed alongside.
* ponytail: one push per branch; batch them into a single push if deleting
* dozens at a time ever gets slow.
*/
async function branchDeleteRemote(cwd, refs) {
	const remotes = (await runGit(cwd, ["remote"])).split("\n").filter((line) => line !== "");
	const failures = [];
	for (const ref of refs) {
		const remote = remotes.find((name) => ref.startsWith(`${name}/`));
		if (remote === void 0) {
			failures.push({
				name: ref,
				message: "unknown remote"
			});
			continue;
		}
		try {
			await runGit(cwd, [
				"push",
				remote,
				"--delete",
				ref.slice(remote.length + 1)
			], 12e4);
		} catch (error) {
			failures.push({
				name: ref,
				message: error instanceof Error ? error.message : String(error)
			});
		}
	}
	return failures;
}
/** Drop remote-tracking refs whose branch no longer exists on the remote. */
async function branchPrune(cwd) {
	const remote = await preferredRemote(cwd);
	if (remote === void 0) throw new GitCommandError("no remote configured", "git-error", "branch prune");
	await runGit(cwd, [
		"remote",
		"prune",
		remote
	], 12e4);
}
/**
* Local and remote branches for the branch manager: what each branch tracks,
* whether its upstream is gone, and whether it is already merged into HEAD —
* the three things a cleanup decision needs. `for-each-ref` has no `-z`, but
* no field here can contain a newline.
*/
async function branchOverview(cwd) {
	const format = "%(refname:strip=2)%1f%(upstream:short)%1f%(upstream:track)%1f%(committerdate:short)%1f%(contents:subject)";
	const [current, remote, localRaw, remoteRaw, mergedRaw] = await Promise.all([
		currentBranch(cwd).catch(() => "HEAD"),
		preferredRemote(cwd),
		runGit(cwd, [
			"for-each-ref",
			"--sort=-committerdate",
			`--format=${format}`,
			"refs/heads"
		]),
		runGit(cwd, [
			"for-each-ref",
			"--sort=-committerdate",
			`--format=${format}`,
			"refs/remotes"
		]),
		runGit(cwd, [
			"for-each-ref",
			"--merged",
			"HEAD",
			"--format=%(refname:strip=2)",
			"refs/heads",
			"refs/remotes"
		]).catch(() => "")
	]);
	const merged = new Set(mergedRaw.split("\n").filter((line) => line !== ""));
	return {
		current,
		remote,
		local: parseBranchRows(localRaw, merged, current),
		remotes: parseBranchRows(remoteRaw, merged, current).filter((entry) => !entry.name.endsWith("/HEAD"))
	};
}
/** Parse the `branchOverview` for-each-ref rows (exported for the unit test). */
function parseBranchRows(raw, merged, current) {
	return raw.split("\n").filter((row) => row !== "").map((row) => {
		const [name = "", upstream = "", track = "", date = "", subject = ""] = row.split("");
		return {
			name,
			current: name === current,
			merged: merged.has(name),
			...upstream === "" ? {} : { upstream },
			gone: track.includes("gone"),
			ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
			behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
			date,
			subject
		};
	});
}
/**
* Patch between two revisions; with `mergeBase` the left side becomes
* `merge-base(from, to)` (what `to` adds since the branches diverged).
*/
async function rangeDiff(cwd, from, to, mergeBase = false) {
	return runGit(cwd, [
		"diff",
		"--no-ext-diff",
		"--no-color",
		mergeBase ? (await runGit(cwd, [
			"merge-base",
			from,
			to
		])).trim() : from,
		to
	]);
}
/** Merge an existing branch into the current branch without opening an editor. */
async function merge(cwd, branch) {
	await runGit(cwd, [
		"merge",
		"--no-edit",
		branch
	]);
}
/** Replay the current branch's commits on top of an existing branch. */
async function rebase(cwd, branch) {
	await runGit(cwd, [
		"rebase",
		"--autostash",
		branch
	]);
}
/** Fast-forward the branch to its upstream (`merge --ff-only`); a dirty working tree is fine as long as it does not touch the incoming files. */
async function fastForward(cwd) {
	await runGit(cwd, [
		"merge",
		"--ff-only",
		"@{upstream}"
	]);
}
/** Linked checkouts for this repository, with the caller's checkout marked. */
async function worktrees(cwd) {
	const [root, raw] = await Promise.all([repoRoot(cwd), runGit(cwd, [
		"worktree",
		"list",
		"--porcelain",
		"-z"
	])]);
	return parseWorktreePorcelainZ(raw).map((entry) => ({
		...entry,
		current: entry.path === root
	}));
}
/** The main checkout's canonical path inside a linked checkout; undefined for the main checkout or outside a repository. */
async function linkedWorktreeMain(cwd) {
	try {
		const [gitDir, commonDir] = (await runGit(cwd, [
			"rev-parse",
			"--path-format=absolute",
			"--git-dir",
			"--git-common-dir"
		])).trim().split("\n");
		if (gitDir === commonDir) return void 0;
		const main = dirname(commonDir);
		return existsSync(main) ? realpathSync(main) : main;
	} catch {
		return;
	}
}
/** Add a linked checkout for an existing branch. */
/** Returns the canonical absolute path, matching how DSH stores workspace and session cwd. */
async function addWorktree(cwd, path, branch, base) {
	await runGit(cwd, [
		"worktree",
		"add",
		...base === void 0 ? [] : ["-b", branch],
		"--",
		path,
		base ?? branch
	]);
	return realpathSync(resolve(cwd, path));
}
async function worktreePathPrefix(cwd) {
	const root = await repoRoot(cwd);
	return `${join(dirname(root), `${basename(root)}-worktrees`)}${sep}`;
}
/** Merge only inside a registered Worktree of the same repository. */
async function mergeWorktree(cwd, targetPath, sourceBranch) {
	let canonical;
	try {
		canonical = realpathSync(targetPath);
	} catch {
		throw new GitCommandError("unknown target worktree", "git-error", "worktree merge");
	}
	const target = (await worktrees(cwd)).find((entry) => {
		try {
			return realpathSync(entry.path) === canonical;
		} catch {
			return false;
		}
	});
	if (target === void 0) throw new GitCommandError("unknown target worktree", "git-error", "worktree merge");
	await merge(target.path, sourceBranch);
}
/** Remove a clean linked checkout; git refuses dirty/current/locked trees. */
/** Returns the canonical path it had, so the caller can drop the DSH Workspace registered for it. */
async function removeWorktree(cwd, path) {
	const absolute = resolve(cwd, path);
	const canonical = existsSync(absolute) ? realpathSync(absolute) : absolute;
	await runGit(cwd, [
		"worktree",
		"remove",
		"--",
		path
	]);
	return canonical;
}
/** In-progress history operation for conflict recovery controls. */
async function operation(cwd) {
	try {
		await runGit(cwd, [
			"rev-parse",
			"-q",
			"--verify",
			"MERGE_HEAD"
		]);
		return "merge";
	} catch {}
	for (const name of ["rebase-merge", "rebase-apply"]) {
		const path = (await runGit(cwd, [
			"rev-parse",
			"--git-path",
			name
		])).trim();
		if (existsSync(resolve(cwd, path))) return "rebase";
	}
	return null;
}
async function continueOperation(cwd, kind) {
	await runGit(cwd, [
		"-c",
		"core.editor=true",
		kind,
		"--continue"
	]);
}
async function abortOperation(cwd, kind) {
	await runGit(cwd, [kind, "--abort"]);
}
/**
* Recent commit history across every branch (newest first, date order so the
* client graph stays consistent while paging), lazily pageable via skip/count.
*/
async function log(cwd, count = 30, skip = 0) {
	return parseLogLines(await runGit(cwd, [
		"log",
		"--all",
		"--date-order",
		"-n",
		String(count),
		"--skip",
		String(skip),
		"--decorate=short",
		"--pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D%x1f%P"
	]));
}
/**
* Content of a file at a revision (`git show <rev>:<path>`), or null when the
* revision has no such path (a new/untracked file has no HEAD side).
*/
async function show(cwd, rev, path) {
	try {
		return await runGit(cwd, ["show", `${rev}:${path}`]);
	} catch {
		return null;
	}
}
/** Full patch text of one commit (`git show` with the commit header suppressed).
*  Merge commits show their diff against the first parent (`-m --first-parent`
*  is a no-op for regular commits), so a history click always has content. */
async function commitDiff(cwd, hash) {
	return runGit(cwd, [
		"show",
		"--no-ext-diff",
		"--no-color",
		"--format=",
		"-m",
		"--first-parent",
		hash
	]);
}
/** Whether HEAD carries this path; an unborn HEAD carries nothing. */
async function inHead(cwd, path) {
	return await runGit(cwd, [
		"ls-tree",
		"-z",
		"HEAD",
		"--",
		path
	]).catch(() => "") !== "";
}
/**
* Discard one path's worktree changes. A path HEAD carries is restored from
* the index (`git checkout -- <path>`, which leaves the index untouched). A
* path HEAD does not carry has no baseline to restore: it is a file the change
* being discarded created, so discarding it removes the file. `git checkout`
* is wrong there — the index holds the addition, so it would rewrite the file
* from the index and report success without changing anything.
*/
async function discard(cwd, path) {
	if (await inHead(cwd, path)) {
		await runGit(cwd, [
			"checkout",
			"--",
			path
		]);
		return;
	}
	await runGit(cwd, [
		"rm",
		"-q",
		"-f",
		"--ignore-unmatch",
		"--",
		path
	]);
	await rm(path, { force: true });
}
/**
* Discard index/worktree changes and remove untracked files and directories.
* Ignored files and nested repositories are not cleaned.
*/
async function discardAll(cwd) {
	const root = await repoRoot(cwd);
	await runGit(root, ["reset", "--hard"]);
	await runGit(root, ["clean", "-fd"]);
}
/** Revert one commit onto the current branch with an auto-generated message. */
async function revert(cwd, hash) {
	await runGit(cwd, [
		"revert",
		"--no-edit",
		hash
	]);
}
/** Cherry-pick one commit onto the current branch. */
async function cherryPick(cwd, hash) {
	await runGit(cwd, ["cherry-pick", hash]);
}
/**
* Every tag, newest-created first. `for-each-ref` has no `-z`, so the rows are
* newline-separated — safe here because neither a ref name nor
* `%(contents:subject)` can contain a newline. A lightweight tag has no
* annotation, so git falls back to the tagged commit's subject.
*/
async function tags(cwd) {
	const remote = await preferredRemote(cwd);
	const [raw, remoteRaw] = await Promise.all([runGit(cwd, [
		"for-each-ref",
		"--sort=-creatordate",
		"--format=%(refname:strip=2)%1f%(contents:subject)%1f%(objectname)",
		"refs/tags"
	]), remote === void 0 ? null : remoteTagRefs(cwd, remote)]);
	return raw.split("\n").filter((row) => row !== "").map((row) => {
		const [name = "", subject = "", object = ""] = row.split("");
		return {
			name,
			subject,
			remoteState: remoteRaw === null ? "unknown" : remoteRaw.get(name) === object ? "synced" : "local"
		};
	});
}
/** Create a tag on `commit` (HEAD when omitted); a non-empty message makes it annotated. */
async function createTag(cwd, name, message, commit) {
	await runGit(cwd, [
		"tag",
		...message !== void 0 && message !== "" ? [
			"-a",
			"-m",
			message
		] : [],
		name,
		...commit === void 0 ? [] : [commit]
	]);
}
/** Delete a local tag (the remote copy, if any, is untouched). */
async function deleteTag(cwd, name) {
	await runGit(cwd, [
		"tag",
		"-d",
		name
	]);
}
/**
* Push one tag. `origin` is the near-universal name, but a repository whose
* single remote is called something else should still work, so fall back to
* the first configured remote rather than failing on a hard-coded name.
*/
async function preferredRemote(cwd) {
	const names = (await runGit(cwd, ["remote"])).split("\n").filter((line) => line !== "");
	return names.includes("origin") ? "origin" : names[0];
}
async function remoteTagRefs(cwd, remote) {
	const key = `${cwd}\0${remote}`;
	const cached = remoteTagCache.get(key);
	if (cached !== void 0 && cached.expires > Date.now()) return cached.refs;
	const raw = await runGit(cwd, [
		"ls-remote",
		"--tags",
		"--refs",
		remote
	], 3e3).catch(() => null);
	const refs = raw === null ? null : new Map(raw.split("\n").filter(Boolean).map((row) => {
		const [object, ref] = row.split("	");
		return [ref?.replace(/^refs\/tags\//, "") ?? "", object ?? ""];
	}));
	remoteTagCache.set(key, {
		expires: Date.now() + 6e4,
		refs
	});
	return refs;
}
async function pushTag(cwd, name) {
	const remote = await preferredRemote(cwd);
	if (remote === void 0) throw new GitCommandError("no remote configured", "git-error", "push tag");
	await runGit(cwd, [
		"push",
		remote,
		`refs/tags/${name}`
	], 12e4);
	remoteTagCache.delete(`${cwd}\0${remote}`);
}
//#endregion
//#region src/wire.ts
/** One API failure with its wire code and HTTP status. */
var SidebarError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20;
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
async function readJsonBody(request) {
	if (request.body === null) return {};
	const reader = request.body.getReader();
	const chunks = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.length;
			if (total > MAX_BODY_BYTES) throw new SidebarError("bad-request", "request body too large");
			chunks.push(Buffer.from(value));
		}
	} finally {
		reader.releaseLock();
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new SidebarError("bad-request", "request body is not valid JSON");
	}
}
/** Build the success envelope. */
function okResponse(value) {
	return Response.json({
		ok: true,
		value
	});
}
/** Build the failure envelope for any thrown value (unknown → internal 500). */
function errorResponse(error) {
	if (error instanceof SidebarError) return Response.json({
		ok: false,
		error: {
			code: error.code,
			message: error.message
		}
	}, { status: error.status });
	const message = error instanceof Error ? error.message : String(error);
	return Response.json({
		ok: false,
		error: {
			code: "internal",
			message
		}
	}, { status: 500 });
}
/** Narrow an unknown payload value to a string, else throw bad-request. */
function requireString(payload, key) {
	const value = payload?.[key];
	if (typeof value !== "string" || value === "") throw new SidebarError("bad-request", `missing or invalid "${key}"`);
	return value;
}
//#endregion
//#region src/index.ts
/** Independent Git operations for the DSH right sidebar. */
const name = "dsh-git-sidebar";
const inject = {
	sessions: { required: true },
	agents: { required: true },
	connection: { required: true },
	workingDirectory: { required: false }
};
const Config = Schema.object({ readLimit: Schema.number().min(1).default(2097152) });
function requireAbsolute(path) {
	if (!isAbsolute(path)) throw new SidebarError("bad-request", "expected an absolute path");
	return resolve(path);
}
/** Narrow a stash ref to the `stash@{n}` shape git itself prints — the ref
*  reaches the host over the wire, and an arbitrary string would let a caller
*  smuggle an option (`--all`) into the git argv. */
function requireStashRef(payload) {
	const ref = requireString(payload, "ref");
	if (!/^stash@\{\d+\}$/.test(ref)) throw new SidebarError("bad-request", "invalid stash ref");
	return ref;
}
/** Reject exactly what `git check-ref-format` rejects for a tag name. The name
*  reaches the host over the wire, so a leading `-` would otherwise be parsed
*  as a git option; the rest keeps the failure at the wire edge instead of as
*  an opaque git error. */
function requireTagName(payload) {
	const name = requireString(payload, "name");
	if (/^[-./]/.test(name) || /[\s~^:?*[\\\x00-\x1f\x7f]/.test(name) || name.includes("..") || name.includes("@{") || name.includes("//") || /(\/|\.|\.lock)$/.test(name)) throw new SidebarError("bad-request", "invalid tag name");
	return name;
}
/** The full 40-char hash the history rows carry; anything else is a caller bug. */
function requireCommitHash(payload, field) {
	const hash = requireString(payload, field);
	if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(hash)) throw new SidebarError("bad-request", "invalid commit hash");
	return hash;
}
/** Revisions are argv operands, never command-line options. */
function requireRevision(payload, key) {
	const value = requireString(payload, key);
	if (value.startsWith("-") || value.includes("\0")) throw new SidebarError("bad-request", "invalid revision");
	return value;
}
/** A non-empty list of revisions (the batch branch operations take one). */
function requireRevisionList(payload, key) {
	const value = payload[key];
	if (!Array.isArray(value) || value.length === 0) throw new SidebarError("bad-request", `expected a non-empty "${key}" list`);
	return value.map((item) => requireRevision({ [key]: item }, key));
}
function requireGitOperation(payload) {
	const operation = requireString(payload, "operation");
	if (operation !== "merge" && operation !== "rebase") throw new SidebarError("bad-request", "invalid git operation");
	return operation;
}
/**
* Resolve a session's authoritative working directory. The attached session
* effective directory wins; while the session is still hydrating from persistence (the
* web client attaches the current conversation a moment after page load, so
* the very first sidebar requests can arrive detached) the caller's own
* list-summary cwd is used; the process cwd is the last resort (blank
* sessions have no cwd anywhere yet). Never throws for a missing cwd, so
* explorer/git/terminal work from first paint instead of surfacing
* "session ... has no working directory".
*/
function sessionCwdOf(ctx, sessionId, clientCwd) {
	const session = ctx.sessions.get(sessionId);
	const directory = ctx.agents.get(sessionId)?.ctx.get("workingDirectory") ?? ctx.workingDirectory;
	if (session !== void 0 && directory !== void 0) return directory.get(session);
	const headerCwd = session?.header.cwd;
	if (headerCwd !== void 0 && headerCwd !== "") return headerCwd;
	if (clientCwd !== void 0 && clientCwd !== "") try {
		return requireAbsolute(clientCwd);
	} catch {
		throw new SidebarError("bad-request", `invalid working directory "${clientCwd}"`);
	}
	return process.cwd();
}
/**
* Resolve a path that a git command reported — `git status`/`git diff`
* print paths RELATIVE TO THE REPO TOP LEVEL, which may sit above the
* session cwd (a session inside a subdirectory of a repository). Absolute
* paths pass through; relative ones join the repo root (falling back to the
* cwd when the root cannot be resolved, e.g. a bare directory).
*/
async function resolveGitPath(cwd, raw) {
	if (isAbsolute(raw)) return requireAbsolute(raw);
	const root = await repoRoot(cwd).catch(() => cwd);
	return requireAbsolute(join(root, raw));
}
const READ_HEAD_LIMIT = 4096;
/** Text read of a file with the size cap; binary detection via NUL probe.
*  Binary reads also return the first {@link READ_HEAD_LIMIT} bytes (base64)
*  so the client can re-match viewers by content (`detect`). */
async function readText(path, readLimit) {
	const info = await stat(path).catch((error) => {
		throw new SidebarError("fs-error", `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400);
	});
	if (info.isDirectory()) throw new SidebarError("fs-error", `"${path}" is a directory`, 400);
	const size = info.size;
	const truncated = size > readLimit;
	const handle = await open(path, "r").catch((error) => {
		throw new SidebarError("fs-error", `cannot read "${path}": ${error instanceof Error ? error.message : String(error)}`, 400);
	});
	try {
		const buffer = Buffer.alloc(Math.min(size, readLimit));
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
		const slice = buffer.subarray(0, bytesRead);
		const binary = slice.includes(0);
		const head = binary ? slice.subarray(0, Math.min(slice.length, READ_HEAD_LIMIT)).toString("base64") : void 0;
		return {
			content: binary ? "" : slice.toString("utf8"),
			truncated,
			binary,
			size,
			head
		};
	} finally {
		await handle.close();
	}
}
function buildApi(ctx, readLimit) {
	const cwdOf = (payload) => {
		const sessionId = requireString(payload, "sessionId");
		const record = payload;
		return {
			sessionId,
			cwd: sessionCwdOf(ctx, sessionId, typeof record.cwd === "string" ? record.cwd : void 0)
		};
	};
	return {
		"fs.read": async (payload) => {
			const { cwd } = cwdOf(payload);
			const result = await readText(await resolveGitPath(cwd, requireString(payload, "path")), readLimit);
			return {
				...result,
				kind: result.binary ? "binary" : "text"
			};
		},
		"git.path": async (payload) => ({ path: await resolveGitPath(cwdOf(payload).cwd, requireString(payload, "path")) }),
		"git.status": async (payload) => {
			const { cwd } = cwdOf(payload);
			return status(cwd);
		},
		"git.diff": async (payload) => {
			const { cwd } = cwdOf(payload);
			const record = payload;
			return { diff: await diff(cwd, record.path === void 0 ? void 0 : await resolveGitPath(cwd, requireString(payload, "path")), record.staged === true) };
		},
		"git.stage": async (payload) => {
			const { cwd } = cwdOf(payload);
			await stage(cwd, payload.path === void 0 ? void 0 : await resolveGitPath(cwd, requireString(payload, "path")));
			return { ok: true };
		},
		"git.unstage": async (payload) => {
			const { cwd } = cwdOf(payload);
			await unstage(cwd, payload.path === void 0 ? void 0 : await resolveGitPath(cwd, requireString(payload, "path")));
			return { ok: true };
		},
		"git.stash": async (payload) => {
			const { cwd } = cwdOf(payload);
			await stash(cwd);
			return { ok: true };
		},
		"git.stash-list": async (payload) => {
			const { cwd } = cwdOf(payload);
			return { entries: await stashList(cwd) };
		},
		"git.stash-pop": async (payload) => {
			const { cwd } = cwdOf(payload);
			await stashPop(cwd, requireStashRef(payload));
			return { ok: true };
		},
		"git.stash-apply": async (payload) => {
			const { cwd } = cwdOf(payload);
			await stashApply(cwd, requireStashRef(payload));
			return { ok: true };
		},
		"git.stash-drop": async (payload) => {
			const { cwd } = cwdOf(payload);
			await stashDrop(cwd, requireStashRef(payload));
			return { ok: true };
		},
		"git.tag-list": async (payload) => {
			const { cwd } = cwdOf(payload);
			return { entries: await tags(cwd) };
		},
		"git.tag-create": async (payload) => {
			const { cwd } = cwdOf(payload);
			const record = payload;
			await createTag(cwd, requireTagName(payload), record.message === void 0 ? void 0 : requireString(payload, "message"), record.commit === void 0 ? void 0 : requireCommitHash(payload, "commit"));
			return { ok: true };
		},
		"git.tag-delete": async (payload) => {
			const { cwd } = cwdOf(payload);
			await deleteTag(cwd, requireTagName(payload));
			return { ok: true };
		},
		"git.tag-push": async (payload) => {
			const { cwd } = cwdOf(payload);
			await pushTag(cwd, requireTagName(payload));
			return { ok: true };
		},
		"git.commit": async (payload) => {
			const { cwd } = cwdOf(payload);
			await commit(cwd, requireString(payload, "message"));
			return { ok: true };
		},
		"git.wip-commit": async (payload) => {
			const { cwd } = cwdOf(payload);
			await wipCommit(cwd);
			return { ok: true };
		},
		"git.fast-forward": async (payload) => {
			const { cwd } = cwdOf(payload);
			await fastForward(cwd);
			return { ok: true };
		},
		"git.reset-to-upstream": async (payload) => {
			const { cwd } = cwdOf(payload);
			await resetToUpstream(cwd);
			return { ok: true };
		},
		"git.wip-undo": async (payload) => {
			const { cwd } = cwdOf(payload);
			await wipUndo(cwd);
			return { ok: true };
		},
		"git.fetch": async (payload) => {
			const { cwd } = cwdOf(payload);
			await fetchRemote(cwd);
			return { ok: true };
		},
		"git.fetch-all": async (payload) => {
			const { cwd } = cwdOf(payload);
			await fetchRemote(cwd, true);
			return { ok: true };
		},
		"git.push": async (payload) => {
			const { cwd } = cwdOf(payload);
			await push(cwd);
			return { ok: true };
		},
		"git.branch": async (payload) => {
			const { cwd } = cwdOf(payload);
			return branches(cwd);
		},
		"git.checkout": async (payload) => {
			const { cwd } = cwdOf(payload);
			await checkout(cwd, requireRevision(payload, "branch"));
			return { ok: true };
		},
		"git.branch-create": async (payload) => {
			const { cwd } = cwdOf(payload);
			await branchCreate(cwd, requireRevision(payload, "name"), requireCommitHash(payload, "commit"));
			return { ok: true };
		},
		"git.branch-list": async (payload) => {
			const { cwd } = cwdOf(payload);
			return branchOverview(cwd);
		},
		"git.branch-delete": async (payload) => {
			const { cwd } = cwdOf(payload);
			const record = payload;
			const names = requireRevisionList(payload, "names");
			return { failed: record.remote === true ? await branchDeleteRemote(cwd, names) : await branchDelete(cwd, names, record.force === true) };
		},
		"git.branch-prune": async (payload) => {
			const { cwd } = cwdOf(payload);
			await branchPrune(cwd);
			return { ok: true };
		},
		"git.range-diff": async (payload) => {
			const { cwd } = cwdOf(payload);
			const mergeBase = payload.mergeBase === true;
			return { diff: await rangeDiff(cwd, requireRevision(payload, "from"), requireRevision(payload, "to"), mergeBase) };
		},
		"git.merge": async (payload) => {
			const { cwd } = cwdOf(payload);
			await merge(cwd, requireRevision(payload, "branch"));
			return { ok: true };
		},
		"git.rebase": async (payload) => {
			const { cwd } = cwdOf(payload);
			await rebase(cwd, requireRevision(payload, "branch"));
			return { ok: true };
		},
		"git.worktree-list": async (payload) => {
			const { cwd } = cwdOf(payload);
			const [entries, pathPrefix] = await Promise.all([worktrees(cwd), worktreePathPrefix(cwd)]);
			return {
				entries,
				pathPrefix
			};
		},
		"git.worktree-linked": async (payload) => {
			const main = await linkedWorktreeMain(requireAbsolute(requireString(payload, "path")));
			return main === void 0 ? { linked: false } : {
				linked: true,
				main
			};
		},
		"git.worktree-add": async (payload) => {
			const { cwd } = cwdOf(payload);
			const record = payload;
			return { path: await addWorktree(cwd, requireString(payload, "path"), requireRevision(payload, "branch"), record.base === void 0 ? void 0 : requireRevision(payload, "base")) };
		},
		"git.worktree-merge": async (payload) => {
			const { cwd } = cwdOf(payload);
			await mergeWorktree(cwd, requireString(payload, "targetPath"), requireRevision(payload, "sourceBranch"));
			return { ok: true };
		},
		"git.worktree-remove": async (payload) => {
			const { cwd } = cwdOf(payload);
			return { path: await removeWorktree(cwd, requireString(payload, "path")) };
		},
		"git.operation": async (payload) => {
			const { cwd } = cwdOf(payload);
			return { operation: await operation(cwd) };
		},
		"git.operation-continue": async (payload) => {
			const { cwd } = cwdOf(payload);
			await continueOperation(cwd, requireGitOperation(payload));
			return { ok: true };
		},
		"git.operation-abort": async (payload) => {
			const { cwd } = cwdOf(payload);
			await abortOperation(cwd, requireGitOperation(payload));
			return { ok: true };
		},
		"git.log": async (payload) => {
			const { cwd } = cwdOf(payload);
			const record = payload;
			return log(cwd, typeof record.count === "number" && Number.isInteger(record.count) && record.count > 0 ? record.count : void 0, typeof record.skip === "number" && Number.isInteger(record.skip) && record.skip >= 0 ? record.skip : void 0);
		},
		"git.commit-diff": async (payload) => {
			const { cwd } = cwdOf(payload);
			return { diff: await commitDiff(cwd, requireCommitHash(payload, "hash")) };
		},
		"git.discard": async (payload) => {
			const { cwd } = cwdOf(payload);
			await discard(cwd, await resolveGitPath(cwd, requireString(payload, "path")));
			return { ok: true };
		},
		"git.discard-all": async (payload) => {
			const { cwd } = cwdOf(payload);
			await discardAll(cwd);
			return { ok: true };
		},
		"git.revert": async (payload) => {
			const { cwd } = cwdOf(payload);
			await revert(cwd, requireCommitHash(payload, "hash"));
			return { ok: true };
		},
		"git.cherry-pick": async (payload) => {
			const { cwd } = cwdOf(payload);
			await cherryPick(cwd, requireCommitHash(payload, "hash"));
			return { ok: true };
		},
		"git.show": async (payload) => {
			const { cwd } = cwdOf(payload);
			const path = await resolveGitPath(cwd, requireString(payload, "path"));
			return { content: await show(cwd, requireRevision(payload, "rev"), path) };
		}
	};
}
function apply(ctx, config) {
	const api = buildApi(ctx, config.readLimit);
	for (const [method, handler] of Object.entries(api)) ctx.connection.fetch.register({
		path: `/api/git-sidebar/${method}`,
		methods: ["POST"],
		requestBody: "streaming",
		fetch: async (request) => {
			try {
				return okResponse(await handler(await readJsonBody(request)));
			} catch (error) {
				return errorResponse(error);
			}
		}
	});
}
//#endregion
export { Config, apply, buildApi, inject, name, requireTagName };

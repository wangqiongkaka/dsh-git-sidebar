import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { alignDiffLines, parseUnifiedDiff } from '../src/client/DiffView.tsx'
import { defaultWorktreeDraft } from '../src/client/GitView.tsx'
import { addWorktree, branchDelete, branchDeleteRemote, branchOverview, branchPrune, branches, createTag, deleteTag, discard, discardAll, fastForward, parseLogLines, parsePorcelainZ, pushTag, rebase, resetToUpstream, stash, stashList, stashPop, status, tags, wipCommit, wipUndo } from '../src/git.ts'

describe('git worktree defaults', () => {
  it('creates a new branch draft based on the current branch', () => {
    expect(defaultWorktreeDraft('feat/current', '/repo-worktrees/')).toEqual({
      createNew: true,
      newBranch: '',
      base: 'feat/current',
      path: '/repo-worktrees/new-branch',
    })
  })

  it('uses HEAD as the base for a detached checkout', () => {
    expect(defaultWorktreeDraft('HEAD', '/repo-worktrees/').base).toBe('HEAD')
  })
})

describe('git parsing', () => {
  it('parses porcelain -z entries including renames', () => {
    const output = ['M  src/a.ts', ' M src/b.ts', '?? src/c.ts', 'R  src/new.ts', 'src/old.ts', ''].join('\0')
    const entries = parsePorcelainZ(output)
    expect(entries).toEqual([
      { path: 'src/a.ts', xy: 'M ' },
      { path: 'src/b.ts', xy: ' M' },
      { path: 'src/c.ts', xy: '??' },
      { path: 'src/new.ts', xy: 'R ' },
    ])
  })

  it('parses log rows with unit separators (full hash + refs)', () => {
    const rows = parseLogLines(
      'abc1234\x1fFirst subject\x1fAlice\x1f2024-01-01 10:00:00 +0800\x1fabc1234def5678abc1234def5678abc1234def5678\x1fHEAD -> main, origin/main\x1fdef5678abc1234def5678abc1234def5678abc1234\n'
      + 'def5678\x1fSecond subject\x1fBob\x1f2024-01-02 10:00:00 +0800\x1fdef5678abc1234def5678abc1234def5678abc1234\x1f\x1f\n',
    )
    expect(rows).toEqual([
      {
        hash: 'abc1234',
        subject: 'First subject',
        author: 'Alice',
        date: '2024-01-01 10:00:00 +0800',
        hashFull: 'abc1234def5678abc1234def5678abc1234def5678',
        refs: 'HEAD -> main, origin/main',
        parents: ['def5678abc1234def5678abc1234def5678abc1234'],
      },
      {
        hash: 'def5678',
        subject: 'Second subject',
        author: 'Bob',
        date: '2024-01-02 10:00:00 +0800',
        hashFull: 'def5678abc1234def5678abc1234def5678abc1234',
        refs: '',
        parents: [],
      },
    ])
  })

  it('parses a multi-file unified diff with aligned line numbers', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      'index 1234567..89abcde 100644',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,4 +1,5 @@ section with @@ inside',
      ' line1',
      '-line2',
      '+line2b',
      ' context',
      '+trailing',
      'diff --git a/README.md b/README.md',
      'new file mode 100644',
      'index 0000000..1234567',
      '--- /dev/null',
      '+++ b/README.md',
      '@@ -0,0 +1,2 @@',
      '+hello',
      '+world',
      '',
    ].join('\n')
    const parsed = parseUnifiedDiff(diff)
    expect(parsed.files).toHaveLength(2)
    const first = parsed.files[0]!
    expect(first.oldPath).toBe('a/src/a.ts')
    expect(first.newPath).toBe('b/src/a.ts')
    expect(first.binary).toBe(false)
    expect(first.hunks).toHaveLength(1)
    expect(first.hunks[0]!.oldStart).toBe(1)
    expect(first.hunks[0]!.newStart).toBe(1)
    expect(first.hunks[0]!.header).toBe(' section with @@ inside')
    expect(first.hunks[0]!.lines).toEqual([
      { kind: 'ctx', text: 'line1', oldNum: 1, newNum: 1 },
      { kind: 'del', text: 'line2', oldNum: 2, newNum: null },
      { kind: 'add', text: 'line2b', oldNum: null, newNum: 2 },
      { kind: 'ctx', text: 'context', oldNum: 3, newNum: 3 },
      { kind: 'add', text: 'trailing', oldNum: null, newNum: 4 },
    ])
    const second = parsed.files[1]!
    expect(second.oldPath).toBe('/dev/null')
    expect(second.hunks[0]!.lines[0]).toEqual({ kind: 'add', text: 'hello', oldNum: null, newNum: 1 })
    expect(second.hunks[0]!.lines[1]).toEqual({ kind: 'add', text: 'world', oldNum: null, newNum: 2 })
  })

  it('parses binary, deletion and no-newline markers', () => {
    const diff = [
      'diff --git a/img.png b/img.png',
      'index 111..222 100644',
      'Binary files a/img.png and b/img.png differ',
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-one',
      '-two',
      '\\ No newline at end of file',
      '',
    ].join('\n')
    const parsed = parseUnifiedDiff(diff)
    expect(parsed.files).toHaveLength(2)
    expect(parsed.files[0]!.binary).toBe(true)
    expect(parsed.files[0]!.hunks).toHaveLength(0)
    const gone = parsed.files[1]!
    expect(gone.newPath).toBe('/dev/null')
    expect(gone.hunks[0]!.lines).toEqual([
      { kind: 'del', text: 'one', oldNum: 1, newNum: null },
      { kind: 'del', text: 'two', oldNum: 2, newNum: null },
      { kind: 'meta', text: ' No newline at end of file', oldNum: null, newNum: null },
    ])
  })

  it('keeps mode/rename-only sections hunkless', () => {
    const parsed = parseUnifiedDiff([
      'diff --git a/run.sh b/run.sh',
      'old mode 100644',
      'new mode 100755',
      'diff --git a/old.ts b/new.ts',
      'similarity index 90%',
      'rename from old.ts',
      'rename to new.ts',
      '',
    ].join('\n'))
    expect(parsed.files).toHaveLength(2)
    expect(parsed.files[0]!.oldPath).toBe('')
    expect(parsed.files[0]!.hunks).toHaveLength(0)
    expect(parsed.files[1]!.hunks).toHaveLength(0)
  })

  it('parses an empty or junk diff into no files', () => {
    expect(parseUnifiedDiff('').files).toEqual([])
    expect(parseUnifiedDiff('no diff here\n').files).toEqual([])
  })

  it('aligns delete/add blocks for split display', () => {
    const lines = parseUnifiedDiff([
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1,3 +1,2 @@',
      ' same',
      '-old one',
      '-old two',
      '+new one',
    ].join('\n')).files[0]!.hunks[0]!.lines

    expect(alignDiffLines(lines).map(row => [row.old?.text ?? null, row.new?.text ?? null])).toEqual([
      ['same', 'same'],
      ['old one', 'new one'],
      ['old two', null],
    ])
  })
})

describe('discard all changes', () => {
  const gitRun = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  // WHY: the new session is matched by cwd, which DSH stores as a realpath;
  // a relative or symlinked path would open a duplicate session.
  it('returns the canonical absolute path of a worktree added by relative path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-worktree-'))
    try {
      const repo = join(dir, 'repo')
      mkdirSync(repo)
      gitRun(repo, ['init', '-q'])
      writeFileSync(join(repo, 'a.txt'), 'a\n')
      gitRun(repo, ['add', '-A'])
      gitRun(repo, ['commit', '-q', '-m', 'base'])
      const head = spawnSync('git', ['branch', '--show-current'], { cwd: repo, encoding: 'utf8' }).stdout.trim()

      const path = await addWorktree(repo, '../wt', 'feat-x', head)

      expect(path).toBe(join(realpathSync(dir), 'wt'))
      expect(existsSync(join(path, 'a.txt'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('discards all changes from a nested cwd while preserving ignored files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-discard-all-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      mkdirSync(join(dir, 'nested'))
      writeFileSync(join(dir, 'a.txt'), 'original a\n')
      writeFileSync(join(dir, 'nested', 'b.txt'), 'original b\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base'])

      writeFileSync(join(dir, 'a.txt'), 'staged a\n')
      gitRun(dir, ['add', 'a.txt'])
      writeFileSync(join(dir, 'a.txt'), 'worktree a\n')
      rmSync(join(dir, 'nested', 'b.txt'))
      writeFileSync(join(dir, 'staged-new.txt'), 'keep staged addition\n')
      gitRun(dir, ['add', 'staged-new.txt'])
      writeFileSync(join(dir, 'loose.txt'), 'keep untracked\n')
      writeFileSync(join(dir, '.git', 'info', 'exclude'), 'ignored.txt\n')
      writeFileSync(join(dir, 'ignored.txt'), 'keep ignored\n')

      await discardAll(join(dir, 'nested'))

      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('original a\n')
      expect(readFileSync(join(dir, 'nested', 'b.txt'), 'utf8')).toBe('original b\n')
      expect(existsSync(join(dir, 'staged-new.txt'))).toBe(false)
      expect(existsSync(join(dir, 'loose.txt'))).toBe(false)
      expect(readFileSync(join(dir, 'ignored.txt'), 'utf8')).toBe('keep ignored\n')
      expect((await status(dir)).entries).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('discards additions before the first commit and preserves ignored files and nested repositories', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-discard-unborn-'))
    try {
      gitRun(dir, ['init', '-q'])
      writeFileSync(join(dir, '.git', 'info', 'exclude'), 'ignored.txt\nforced.txt\n')
      writeFileSync(join(dir, 'ignored.txt'), 'keep\n')
      writeFileSync(join(dir, 'forced.txt'), 'added despite ignore\n')
      writeFileSync(join(dir, 'added.txt'), 'added\n')
      gitRun(dir, ['add', '-f', 'added.txt', 'forced.txt'])
      mkdirSync(join(dir, 'new-dir'))
      writeFileSync(join(dir, 'new-dir', 'loose.txt'), 'untracked\n')
      mkdirSync(join(dir, 'nested-repo'))
      gitRun(join(dir, 'nested-repo'), ['init', '-q'])
      writeFileSync(join(dir, 'nested-repo', 'keep.txt'), 'keep nested\n')

      await discardAll(dir)

      expect(existsSync(join(dir, 'added.txt'))).toBe(false)
      expect(existsSync(join(dir, 'forced.txt'))).toBe(false)
      expect(existsSync(join(dir, 'new-dir'))).toBe(false)
      expect(readFileSync(join(dir, 'ignored.txt'), 'utf8')).toBe('keep\n')
      expect(readFileSync(join(dir, 'nested-repo', 'keep.txt'), 'utf8')).toBe('keep nested\n')
      expect(gitRun(dir, ['diff', '--cached', '--name-only'])).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // WHY: `git checkout -- <path>` rewrites an addition from the index and
  // reports success without changing anything, so discarding a new file used
  // to do nothing at all. HEAD is what decides restore versus delete.
  it('deletes a file HEAD does not carry and restores one it does', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-discard-one-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'tracked.txt'), 'original\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base'])

      // A tracked file keeps its HEAD content and stays on disk.
      writeFileSync(join(dir, 'tracked.txt'), 'edited\n')
      await discard(dir, join(dir, 'tracked.txt'))
      expect(readFileSync(join(dir, 'tracked.txt'), 'utf8')).toBe('original\n')

      // A staged addition (`A `) is the case the report named.
      writeFileSync(join(dir, 'added.txt'), 'new\n')
      gitRun(dir, ['add', 'added.txt'])
      await discard(dir, join(dir, 'added.txt'))
      expect(existsSync(join(dir, 'added.txt'))).toBe(false)

      // A staged addition edited afterwards (`AM`) must not block the delete.
      writeFileSync(join(dir, 'edited.txt'), 'new\n')
      gitRun(dir, ['add', 'edited.txt'])
      writeFileSync(join(dir, 'edited.txt'), 'changed again\n')
      await discard(dir, join(dir, 'edited.txt'))
      expect(existsSync(join(dir, 'edited.txt'))).toBe(false)

      // An untracked file the index never carried is removed just the same.
      writeFileSync(join(dir, 'loose.txt'), 'never added\n')
      await discard(dir, join(dir, 'loose.txt'))
      expect(existsSync(join(dir, 'loose.txt'))).toBe(false)

      expect((await status(dir)).entries).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ahead / behind', () => {
  const gitRun = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  it('counts commits on both sides of the upstream', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-sidebar-ahead-behind-'))
    const remote = join(root, 'remote')
    const local = join(root, 'local')
    try {
      mkdirSync(remote)
      gitRun(remote, ['init', '-q', '-b', 'main'])
      writeFileSync(join(remote, 'a.txt'), 'base\n')
      gitRun(remote, ['add', '-A'])
      gitRun(remote, ['commit', '-q', '-m', 'base'])
      gitRun(root, ['clone', '-q', remote, local])
      expect(await status(local)).toMatchObject({ ahead: 0, behind: 0 })

      writeFileSync(join(remote, 'a.txt'), 'remote 1\n')
      gitRun(remote, ['commit', '-q', '-am', 'remote 1'])
      writeFileSync(join(remote, 'a.txt'), 'remote 2\n')
      gitRun(remote, ['commit', '-q', '-am', 'remote 2'])
      writeFileSync(join(local, 'b.txt'), 'local\n')
      gitRun(local, ['add', '-A'])
      gitRun(local, ['commit', '-q', '-m', 'local'])
      gitRun(local, ['fetch', '-q'])

      expect(await status(local)).toMatchObject({ ahead: 1, behind: 2 })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('stash stack', () => {
  const gitRun = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  // WHY: the panel's three change groups must all clear on Stash and all come
  // back on Pop — an untracked file left behind reads as "the button did
  // nothing", which is exactly what --include-untracked prevents.
  it('stashes tracked and untracked changes together and restores them on pop', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-stash-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'original a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base'])

      expect(await stashList(dir)).toEqual([])

      writeFileSync(join(dir, 'a.txt'), 'changed a\n')
      writeFileSync(join(dir, 'loose.txt'), 'untracked\n')
      await stash(dir)

      expect((await status(dir)).entries).toEqual([])
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('original a\n')
      expect(existsSync(join(dir, 'loose.txt'))).toBe(false)

      const entries = await stashList(dir)
      expect(entries).toHaveLength(1)
      expect(entries[0]!.ref).toBe('stash@{0}')
      expect(entries[0]!.message).toContain('main')

      await stashPop(dir, 'stash@{0}')
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('changed a\n')
      expect(readFileSync(join(dir, 'loose.txt'), 'utf8')).toBe('untracked\n')
      expect(await stashList(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('WIP commit', () => {
  const gitRun = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  // WHY: a WIP commit must sweep up untracked files too (otherwise the panel
  // still shows changes), and undo must refuse to reset anything but a WIP
  // commit so a real commit can never be lost through this menu.
  it('commits every change as WIP, undoes it back to the working tree, and refuses to undo a real commit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-wip-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'original a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base'])

      await expect(wipUndo(dir)).rejects.toThrow('not a WIP commit')

      writeFileSync(join(dir, 'a.txt'), 'changed a\n')
      writeFileSync(join(dir, 'loose.txt'), 'untracked\n')
      await wipCommit(dir)
      expect((await status(dir)).entries).toEqual([])
      expect(gitRun(dir, ['log', '-1', '--format=%s']).trim()).toBe('WIP')

      await wipUndo(dir)
      expect(gitRun(dir, ['log', '-1', '--format=%s']).trim()).toBe('base')
      expect((await status(dir)).entries).toEqual([
        { path: 'a.txt', xy: ' M' },
        { path: 'loose.txt', xy: '??' },
      ])
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('changed a\n')

      // Once the WIP commit is on the upstream, undo must refuse (no force-push in the panel).
      const remote = mkdtempSync(join(tmpdir(), 'dsh-sidebar-wip-remote-'))
      try {
        gitRun(remote, ['init', '-q', '--bare'])
        gitRun(dir, ['remote', 'add', 'origin', remote])
        await wipCommit(dir)
        gitRun(dir, ['push', '-q', '-u', 'origin', 'main'])
        await expect(wipUndo(dir)).rejects.toThrow('already pushed')
        expect(gitRun(dir, ['log', '-1', '--format=%s']).trim()).toBe('WIP')

        // Reset to remote unwinds every unpushed commit (here: two) into the working tree.
        writeFileSync(join(dir, 'a.txt'), 'local one\n')
        gitRun(dir, ['commit', '-q', '-am', 'local one'])
        writeFileSync(join(dir, 'b.txt'), 'local two\n')
        gitRun(dir, ['add', '-A'])
        gitRun(dir, ['commit', '-q', '-m', 'local two'])
        await resetToUpstream(dir)
        expect(gitRun(dir, ['log', '-1', '--format=%s']).trim()).toBe('WIP')
        expect((await status(dir)).entries).toEqual([
          { path: 'a.txt', xy: ' M' },
          { path: 'b.txt', xy: '??' },
        ])
        expect(readFileSync(join(dir, 'b.txt'), 'utf8')).toBe('local two\n')

        // Fast-forward pulls a remote-only commit even with a dirty working tree.
        const clone = mkdtempSync(join(tmpdir(), 'dsh-sidebar-wip-clone-'))
        try {
          gitRun(clone, ['clone', '-q', remote, '.'])
          writeFileSync(join(clone, 'c.txt'), 'from clone\n')
          gitRun(clone, ['add', '-A'])
          gitRun(clone, ['commit', '-q', '-m', 'remote only'])
          gitRun(clone, ['push', '-q', 'origin', 'main'])
        } finally {
          rmSync(clone, { recursive: true, force: true })
        }
        gitRun(dir, ['fetch', '-q'])
        await fastForward(dir)
        expect(gitRun(dir, ['log', '-1', '--format=%s']).trim()).toBe('remote only')
        expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('local one\n')

        // Rebase auto-stashes the dirty working tree and restores it afterwards.
        gitRun(dir, ['branch', 'side', 'HEAD~1'])
        await rebase(dir, 'side')
        expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('local one\n')
        expect((await status(dir)).entries).toContainEqual({ path: 'a.txt', xy: ' M' })
      } finally {
        rmSync(remote, { recursive: true, force: true })
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('tags', () => {
  /** `date` pins both commit dates, so tags created in the same second still
   *  have an unambiguous creation order to sort by. */
  const gitRun = (cwd: string, args: string[], date?: string): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
        ...(date === undefined ? {} : { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }),
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  // WHY: the tag row is the only place the user reads what a tag means, and the
  // two tag kinds carry that text in different places — an annotated tag in its
  // own message, a lightweight one only in the commit it points at. Reading the
  // wrong field would leave every lightweight tag with a blank row.
  it('lists both tag kinds newest-first with the right subject, and drops a deleted one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-tag-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base commit'], '2020-01-01T00:00:00+0000')

      expect(await tags(dir)).toEqual([])

      // A lightweight tag inherits its commit's date (2020), while an annotated
      // tag is stamped now — so v0.2.0 is unambiguously the newer of the two.
      await createTag(dir, 'v0.1.0')
      await createTag(dir, 'v0.2.0', 'second release')

      expect(await tags(dir)).toEqual([
        { name: 'v0.2.0', subject: 'second release', remoteState: 'unknown' },
        { name: 'v0.1.0', subject: 'base commit', remoteState: 'unknown' },
      ])

      await deleteTag(dir, 'v0.2.0')
      expect(await tags(dir)).toEqual([{ name: 'v0.1.0', subject: 'base commit', remoteState: 'unknown' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps tag names usable when a branch has the same name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-tag-ambiguous-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base commit'])
      gitRun(dir, ['branch', '0.1.2'])
      await createTag(dir, '0.1.2')

      expect((await branches(dir)).names).toContain('0.1.2')
      expect(await tags(dir)).toEqual([{ name: '0.1.2', subject: 'base commit', remoteState: 'unknown' }])
      await deleteTag(dir, (await tags(dir))[0]!.name)
      expect(await tags(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // WHY: the history menu's whole point is tagging a commit that is not HEAD;
  // if the commit argument were dropped the tag would silently land on the
  // latest commit instead of the one the user right-clicked.
  it('tags the requested commit rather than HEAD', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-tag-commit-'))
    try {
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'older commit'])
      const older = gitRun(dir, ['rev-parse', 'HEAD']).trim()
      writeFileSync(join(dir, 'a.txt'), 'b\n')
      gitRun(dir, ['commit', '-q', '-am', 'newer commit'])

      await createTag(dir, 'on-older', '', older)

      expect(gitRun(dir, ['rev-parse', 'on-older']).trim()).toBe(older)
      expect(await tags(dir)).toEqual([{ name: 'on-older', subject: 'older commit', remoteState: 'unknown' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports whether each local tag matches the preferred remote', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-sidebar-tag-sync-'))
    const remote = mkdtempSync(join(tmpdir(), 'dsh-sidebar-tag-remote-'))
    try {
      gitRun(remote, ['init', '-q', '--bare'])
      gitRun(dir, ['init', '-q'])
      gitRun(dir, ['checkout', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'a\n')
      gitRun(dir, ['add', '-A'])
      gitRun(dir, ['commit', '-q', '-m', 'base commit'])
      gitRun(dir, ['remote', 'add', 'origin', remote])
      await createTag(dir, 'v0.1.0')
      gitRun(dir, ['push', '-q', 'origin', 'refs/tags/v0.1.0'])
      await createTag(dir, 'v0.2.0', 'local release')

      const entries = await tags(dir)
      expect(entries).toHaveLength(2)
      expect(entries).toEqual(expect.arrayContaining([
        { name: 'v0.2.0', subject: 'local release', remoteState: 'local' },
        { name: 'v0.1.0', subject: 'base commit', remoteState: 'synced' },
      ]))

      await pushTag(dir, 'v0.2.0')
      expect((await tags(dir)).find(entry => entry.name === 'v0.2.0')?.remoteState).toBe('synced')
    } finally {
      rmSync(dir, { recursive: true, force: true })
      rmSync(remote, { recursive: true, force: true })
    }
  })
})

describe('branch manager', () => {
  const gitRun = (cwd: string, args: string[]): string => {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dsh-better-sidebar-test',
        GIT_AUTHOR_EMAIL: 'test@dsh.invalid',
        GIT_COMMITTER_NAME: 'dsh-better-sidebar-test',
        GIT_COMMITTER_EMAIL: 'test@dsh.invalid',
      },
    })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0] ?? ''} failed`)
    return result.stdout
  }

  it('lists merged / gone state and cleans up local and remote branches in batches', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-sidebar-branches-'))
    const remote = join(root, 'remote')
    const local = join(root, 'local')
    try {
      mkdirSync(remote)
      gitRun(remote, ['init', '-q', '-b', 'main'])
      writeFileSync(join(remote, 'a.txt'), 'base\n')
      gitRun(remote, ['add', '-A'])
      gitRun(remote, ['commit', '-q', '-m', 'base'])
      gitRun(remote, ['branch', 'feature'])
      gitRun(remote, ['branch', 'doomed'])
      gitRun(root, ['clone', '-q', remote, local])
      // done: merged into main. wip: one unmerged commit. tracks-feature: an upstream about to disappear.
      gitRun(local, ['branch', 'done'])
      gitRun(local, ['checkout', '-q', '-b', 'wip'])
      writeFileSync(join(local, 'b.txt'), 'wip\n')
      gitRun(local, ['add', '-A'])
      gitRun(local, ['commit', '-q', '-m', 'wip'])
      gitRun(local, ['checkout', '-q', 'main'])
      gitRun(local, ['branch', '--track', 'tracks-feature', 'origin/feature'])

      const overview = await branchOverview(local)
      expect(overview).toMatchObject({ current: 'main', remote: 'origin' })
      expect(overview.local.map(entry => entry.name).sort()).toEqual(['done', 'main', 'tracks-feature', 'wip'])
      expect(overview.local.find(entry => entry.name === 'main')).toMatchObject({ current: true, merged: true })
      expect(overview.local.find(entry => entry.name === 'done')).toMatchObject({ current: false, merged: true, gone: false })
      expect(overview.local.find(entry => entry.name === 'wip')).toMatchObject({ merged: false })
      expect(overview.local.find(entry => entry.name === 'tracks-feature')).toMatchObject({ upstream: 'origin/feature', gone: false })
      expect(overview.remotes.map(entry => entry.name)).toContain('origin/feature')
      expect(overview.remotes.some(entry => entry.name.endsWith('/HEAD'))).toBe(false)

      // A batch keeps going past the unmerged branch and reports it by name.
      expect((await branchDelete(local, ['done', 'wip'])).map(entry => entry.name)).toEqual(['wip'])
      expect((await branches(local)).names).not.toContain('done')
      expect(await branchDelete(local, ['wip'], true)).toEqual([])
      expect((await branches(local)).names).not.toContain('wip')

      expect(await branchDeleteRemote(local, ['origin/doomed'])).toEqual([])
      expect(gitRun(remote, ['branch', '--list', 'doomed']).trim()).toBe('')
      expect((await branchDeleteRemote(local, ['nowhere/x']))[0]).toMatchObject({ name: 'nowhere/x' })

      // The remote drops a branch behind our back: prune clears the stale ref
      // and the branch tracking it turns up as [gone].
      gitRun(remote, ['branch', '-D', 'feature'])
      await branchPrune(local)
      const pruned = await branchOverview(local)
      expect(pruned.remotes.map(entry => entry.name)).not.toContain('origin/feature')
      expect(pruned.local.find(entry => entry.name === 'tracks-feature')).toMatchObject({ gone: true })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

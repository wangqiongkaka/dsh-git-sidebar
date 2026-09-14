import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '../src/client/DiffView.tsx'
import { defaultWorktreeDraft } from '../src/client/GitView.tsx'
import { createTag, deleteTag, discardAll, parseLogLines, parsePorcelainZ, stash, stashList, stashPop, status, tags } from '../src/git.ts'

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
      'abc1234\x1fFirst subject\x1fAlice\x1f2024-01-01 10:00:00 +0800\x1fabc1234def5678abc1234def5678abc1234def5678\x1fHEAD -> main, origin/main\n'
      + 'def5678\x1fSecond subject\x1fBob\x1f2024-01-02 10:00:00 +0800\x1fdef5678abc1234def5678abc1234def5678abc1234\x1f\n',
    )
    expect(rows).toEqual([
      {
        hash: 'abc1234',
        subject: 'First subject',
        author: 'Alice',
        date: '2024-01-01 10:00:00 +0800',
        hashFull: 'abc1234def5678abc1234def5678abc1234def5678',
        refs: 'HEAD -> main, origin/main',
      },
      {
        hash: 'def5678',
        subject: 'Second subject',
        author: 'Bob',
        date: '2024-01-02 10:00:00 +0800',
        hashFull: 'def5678abc1234def5678abc1234def5678abc1234',
        refs: '',
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

  it('restores tracked files from a nested cwd while preserving untracked files', async () => {
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

      await discardAll(join(dir, 'nested'))

      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('original a\n')
      expect(readFileSync(join(dir, 'nested', 'b.txt'), 'utf8')).toBe('original b\n')
      expect(readFileSync(join(dir, 'staged-new.txt'), 'utf8')).toBe('keep staged addition\n')
      expect(readFileSync(join(dir, 'loose.txt'), 'utf8')).toBe('keep untracked\n')
      expect(existsSync(join(dir, 'staged-new.txt'))).toBe(true)
      expect((await status(dir)).entries).toEqual([
        { path: 'loose.txt', xy: '??' },
        { path: 'staged-new.txt', xy: '??' },
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
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
        { name: 'v0.2.0', subject: 'second release' },
        { name: 'v0.1.0', subject: 'base commit' },
      ])

      await deleteTag(dir, 'v0.2.0')
      expect(await tags(dir)).toEqual([{ name: 'v0.1.0', subject: 'base commit' }])
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
      expect(await tags(dir)).toEqual([{ name: 'on-older', subject: 'older commit' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

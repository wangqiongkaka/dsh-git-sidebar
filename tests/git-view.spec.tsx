// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { api, type GitLogEntry, type GitStashEntry, type GitStatusResult, type GitTagEntry } from '../src/client/api.ts'
import { changeTree, GitView, listPathParts, resetViewMemory } from '../src/client/GitView.tsx'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const dirtyStatus: GitStatusResult = {
  isRepo: true,
  branch: 'main',
  ahead: 0,
  behind: 0,
  entries: [
    { path: 'staged.ts', xy: 'M ' },
    { path: 'unstaged.ts', xy: ' M' },
    { path: 'new.ts', xy: '??' },
  ],
}

const stashStack: GitStashEntry[] = [
  { ref: 'stash@{0}', message: 'WIP on main: 1a2b3c4 newest' },
  { ref: 'stash@{1}', message: 'WIP on main: 5d6e7f8 older' },
]

const tagList: GitTagEntry[] = [
  { name: 'v0.2.0', subject: 'second release' },
  { name: 'v0.1.0', subject: 'base commit' },
]

const logEntry: GitLogEntry = {
  hash: '1a2b3c4',
  hashFull: '1a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d',
  subject: 'older commit',
  author: 'Alice',
  date: '2024-01-01 10:00:00 +0800',
  refs: '',
  parents: [],
}

const flush = async (): Promise<void> => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

function renderGitView(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(GitView, {
      scope: { sessionId: 'session-1', cwd: '/repo' },
      onOpenFile: () => {},
      onOpenDiff: () => {},
      onPrompt: async () => {},
      onOpenWorktree: async () => {},
    }))
  })
  return { container, root }
}

/** List actions (stage all, stash, new tag, discard all) live in the "…" menu. */
function openMoreMenu(): void {
  const anchor = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.getAttribute('aria-label') === 'More actions' || button.getAttribute('aria-label') === '更多操作')!
  act(() => { anchor.click() })
}

/** Stash and Tag start folded; open one by its list id prefix. */
function expandSection(container: HTMLElement, prefix: string): void {
  const toggle = container.querySelector<HTMLButtonElement>(`button[aria-controls^="${prefix}"]`)!
  if (toggle.getAttribute('aria-expanded') === 'false') act(() => { toggle.click() })
}

function discardButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(button =>
    button.textContent?.trim() === 'Discard all changes' || button.textContent?.trim() === '放弃所有更改',
  )
}

beforeEach(() => {
  vi.spyOn(api, 'gitStatus').mockResolvedValue(dirtyStatus)
  vi.spyOn(api, 'gitBranch').mockResolvedValue({ current: 'main', names: ['main'] })
  vi.spyOn(api, 'gitLog').mockResolvedValue([])
  vi.spyOn(api, 'gitWorktrees').mockResolvedValue({ entries: [], pathPrefix: '' })
  vi.spyOn(api, 'gitOperation').mockResolvedValue({ operation: null })
  vi.spyOn(api, 'gitDiscardAll').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitStashList').mockResolvedValue({ entries: stashStack })
  vi.spyOn(api, 'gitStash').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitStage').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitWipCommit').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitWipUndo').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitStashPop').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitTags').mockResolvedValue({ entries: tagList })
  vi.spyOn(api, 'gitTagCreate').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitTagDelete').mockResolvedValue({ ok: true })
  vi.spyOn(api, 'gitTagPush').mockResolvedValue({ ok: true })
})

afterEach(() => {
  resetViewMemory()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('GitView change groups', () => {
  it('splits a path into file name and directory, keeping an untracked folder whole', () => {
    expect(listPathParts('components/video/EpisodeNativeAd.nvue')).toEqual({ name: 'EpisodeNativeAd.nvue', directory: 'components/video' })
    expect(listPathParts('README.md')).toEqual({ name: 'README.md', directory: '' })
    expect(listPathParts('newdir/')).toEqual({ name: 'newdir/', directory: '' })
    expect(listPathParts('src/newdir/')).toEqual({ name: 'newdir/', directory: 'src' })
  })

  it('nests changed files by directory and compacts single-folder chains', () => {
    const tree = changeTree([
      { path: 'lib/deep/x/y.ts', xy: ' M' },
      { path: 'newdir/', xy: '??' },
      { path: 'README.md', xy: ' M' },
      { path: 'src/a.ts', xy: ' M' },
      { path: 'src/client/b.ts', xy: ' M' },
    ])
    expect(tree.files.map(entry => entry.path)).toEqual(['newdir/', 'README.md'])
    expect(tree.directories.map(directory => [directory.name, directory.path])).toEqual([['lib/deep/x', 'lib/deep/x'], ['src', 'src']])
    const src = tree.directories[1]!
    expect(src.files.map(entry => entry.path)).toEqual(['src/a.ts'])
    expect(src.directories.map(directory => [directory.name, directory.path])).toEqual([['client', 'src/client']])
    expect(src.directories[0]!.files.map(entry => entry.path)).toEqual(['src/client/b.ts'])
  })

  it('switches between tree and list, folds folders, and remembers both across a remount', async () => {
    vi.mocked(api.gitStatus).mockResolvedValue({
      ...dirtyStatus,
      entries: [{ path: 'src/a.ts', xy: ' M' }, { path: 'src/client/GitView.tsx', xy: ' M' }, { path: 'README.md', xy: ' M' }],
    })
    const fileButton = (container: HTMLElement, path: string) => container.querySelector<HTMLButtonElement>(`button[title="${path}"]`)
    const folderToggle = (container: HTMLElement, path: string) => container.querySelector<HTMLButtonElement>(`[data-change-directory="${path}"] > button`)!
    const first = renderGitView()
    try {
      await flush()
      expect(folderToggle(first.container, 'src/client')).not.toBeNull()
      expect(fileButton(first.container, 'src/client/GitView.tsx')?.textContent).not.toContain('src/client')
      act(() => { folderToggle(first.container, 'src').click() })
      expect(folderToggle(first.container, 'src').getAttribute('aria-expanded')).toBe('false')
      expect(fileButton(first.container, 'src/a.ts')).toBeNull()
      expect(fileButton(first.container, 'src/client/GitView.tsx')).toBeNull()
      expect(fileButton(first.container, 'README.md')).not.toBeNull()
    } finally {
      act(() => { first.root.unmount() })
      first.container.remove()
    }

    const second = renderGitView()
    try {
      await flush()
      expect(folderToggle(second.container, 'src').getAttribute('aria-expanded')).toBe('false')
      openMoreMenu()
      const list = menuItem('View as list') ?? menuItem('以列表形式查看')
      expect(list).toBeDefined()
      act(() => { list!.click() })
      expect(second.container.querySelector('[data-change-directory]')).toBeNull()
      expect(fileButton(second.container, 'src/client/GitView.tsx')?.textContent).toContain('src/client')
    } finally {
      act(() => { second.root.unmount() })
      second.container.remove()
    }

    const third = renderGitView()
    try {
      await flush()
      expect(third.container.querySelector('[data-change-directory]')).toBeNull()
      openMoreMenu()
      expect(menuItem('View as tree') ?? menuItem('以树形式查看')).toBeDefined()
    } finally {
      act(() => { third.root.unmount() })
      third.container.remove()
    }
  })

  it('pads the commit card so it ends on the same line as the chat composer card', async () => {
    const seat = document.createElement('div')
    seat.setAttribute('data-composer-seat', '')
    const card = document.createElement('div')
    card.setAttribute('data-composer-card', '')
    seat.append(card)
    document.body.append(seat)
    const rect = (bottom: number) => ({ bottom, top: bottom - 98, left: 0, right: 100, width: 100, height: 98, x: 0, y: bottom - 98, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this === card ? rect(670) : rect(700)
    })
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      return (this === card ? [rect(670)] : []) as unknown as DOMRectList
    })
    const { container, root } = renderGitView()
    try {
      await flush()
      const commitBox = container.querySelector('textarea')!.parentElement!.parentElement!
      expect(commitBox.style.paddingBottom).toBe('30px')
      seat.remove()
      act(() => { window.dispatchEvent(new Event('resize')) })
      expect(commitBox.style.paddingBottom).toBe('')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('commits from the send button inside the commit card', async () => {
    const commit = vi.spyOn(api, 'gitCommit').mockResolvedValue({ ok: true })
    const { container, root } = renderGitView()
    try {
      await flush()
      const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(node => node.getAttribute('aria-label') === 'Commit' || node.getAttribute('aria-label') === '提交')!
      expect(button.disabled).toBe(true)
      const input = container.querySelector('textarea')!
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'feat: card')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(button.disabled).toBe(false)
      await act(async () => { button.click() })
      expect(commit).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, 'feat: card')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('renders one changes list with stage checkboxes; stash and tag start folded', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      const toggles = [...container.querySelectorAll<HTMLButtonElement>('button[aria-controls^="git-"]')]
      expect(toggles.map(button => button.getAttribute('aria-controls')?.replace(/-:.*$/, ''))).toEqual([
        'git-changes',
        'git-stash-entries',
        'git-tag-entries',
        'git-history',
      ])
      expect(toggles.map(button => button.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'true'])
      expect(container.textContent).toContain('staged.ts')
      expect(container.textContent).toContain('unstaged.ts')
      expect(container.textContent).toContain('new.ts')
      const checks = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      expect(checks.map(check => check.checked)).toEqual([true, false, false])

      await act(async () => { checks[1]!.click(); await Promise.resolve() })
      expect(api.gitStage).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, 'unstaged.ts')

      act(() => { toggles[0]!.click() })
      expect(toggles[0]!.getAttribute('aria-expanded')).toBe('false')
      expect(container.textContent).not.toContain('staged.ts')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('confirms discard-all, refreshes on success, and keeps untracked files visible', async () => {
    const cleanTracked: GitStatusResult = {
      ...dirtyStatus,
      entries: [{ path: 'new.ts', xy: '??' }],
    }
    vi.mocked(api.gitStatus).mockResolvedValueOnce(dirtyStatus).mockResolvedValue(cleanTracked)
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      expect(discardButtons()).toHaveLength(1)
      act(() => { discardButtons()[0]!.click() })
      expect(document.body.textContent).toContain('2')
      expect(document.body.textContent).toMatch(/Untracked files will be kept|未跟踪文件将保留/)

      const confirm = discardButtons().at(-1)!
      await act(async () => { confirm.click(); await Promise.resolve() })
      await flush()

      expect(api.gitDiscardAll).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })
      expect(api.gitStatus).toHaveBeenCalledTimes(2)
      expect(container.textContent).not.toContain('staged.ts')
      expect(container.textContent).not.toContain('unstaged.ts')
      expect(container.textContent).toContain('new.ts')
      openMoreMenu()
      expect(discardButtons()[0]!.disabled).toBe(true)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('keeps the current list and reports an error when discard-all fails', async () => {
    vi.mocked(api.gitDiscardAll).mockRejectedValue(new Error('discard failed'))
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      act(() => { discardButtons()[0]!.click() })
      const confirm = discardButtons().at(-1)!
      await act(async () => { confirm.click(); await Promise.resolve() })
      await flush()

      expect(container.textContent).toContain('discard failed')
      expect(container.textContent).toContain('staged.ts')
      expect(container.textContent).toContain('unstaged.ts')
      expect(container.textContent).toContain('new.ts')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })
})

/** The stash section's action button (header) by its label. */
function stashSaveButton(): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.textContent?.trim() === 'Stash all' || button.textContent?.trim() === '存入 Stash')!
}

/** A menu item by its visible label (the Menu renders through a portal). */
function menuItem(label: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .find(node => node.textContent?.trim() === label)
}

describe('GitView stash', () => {
  it('lists the stash stack newest first with its count', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      expandSection(container, 'git-stash-entries')
      expect(container.textContent).toMatch(/Stash\s*2/)
      expect(container.textContent).toContain('stash@{0}')
      expect(container.textContent).toContain('WIP on main: 1a2b3c4 newest')
      expect(container.textContent).toContain('stash@{1}')
      const refs = [...container.querySelectorAll('[id^="git-stash-entries-"] button')]
        .map(node => node.textContent ?? '')
      expect(refs[0]).toContain('stash@{0}')
      expect(refs[1]).toContain('stash@{1}')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  // WHY: stashing is only meaningful when there is something to stash; an
  // enabled button on a clean tree just produces a git error.
  it('disables the stash button when the three change groups are empty', async () => {
    vi.mocked(api.gitStatus).mockResolvedValue({ isRepo: true, branch: 'main', ahead: 0, behind: 0, entries: [] })
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      expect(stashSaveButton().disabled).toBe(true)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('stashes every change and refreshes the panel', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      expect(stashSaveButton().disabled).toBe(false)
      await act(async () => { stashSaveButton().click(); await Promise.resolve() })
      await flush()

      expect(api.gitStash).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })
      expect(api.gitStatus).toHaveBeenCalledTimes(2)
      expect(api.gitStashList).toHaveBeenCalledTimes(2)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('commits as WIP from the more menu and only offers undo when HEAD is a WIP commit', async () => {
    const menuButton = (labels: string[]): HTMLButtonElement => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => labels.includes(button.textContent?.trim() ?? ''))!
    vi.mocked(api.gitLog).mockResolvedValue([{ ...logEntry, subject: 'WIP', refs: 'HEAD -> main' }])
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      expect(menuButton(['Undo WIP…', '撤销 WIP…']).disabled).toBe(false)
      await act(async () => { menuButton(['Commit as WIP', '提交为 WIP']).click(); await Promise.resolve() })
      await flush()
      expect(api.gitWipCommit).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })
      expect(api.gitStatus).toHaveBeenCalledTimes(2)

      vi.mocked(api.gitLog).mockResolvedValue([{ ...logEntry, refs: 'HEAD -> main' }])
      openMoreMenu()
      await act(async () => { menuButton(['Refresh', '刷新']).click(); await Promise.resolve() })
      await flush()
      openMoreMenu()
      expect(menuButton(['Undo WIP…', '撤销 WIP…']).disabled).toBe(true)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('offers reset-to-remote only when ahead, and unwinds after confirming', async () => {
    vi.spyOn(api, 'gitResetToUpstream').mockResolvedValue({ ok: true })
    vi.mocked(api.gitStatus).mockResolvedValue({ ...dirtyStatus, ahead: 2 })
    const buttons = (labels: string[]): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => labels.includes(button.textContent?.trim() ?? ''))
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      act(() => { buttons(['Reset to remote…', '回到远端状态…'])[0]!.click() })
      expect(document.body.textContent).toMatch(/2 local commit|2 个提交/)
      await act(async () => { buttons(['Reset to remote', '回到远端状态']).at(-1)!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitResetToUpstream).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })

      vi.mocked(api.gitStatus).mockResolvedValue(dirtyStatus)
      openMoreMenu()
      await act(async () => { buttons(['Refresh', '刷新'])[0]!.click(); await Promise.resolve() })
      await flush()
      openMoreMenu()
      expect(buttons(['Reset to remote…', '回到远端状态…'])[0]!.disabled).toBe(true)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('asks before sync would push a WIP commit, and pushes only after confirming', async () => {
    vi.spyOn(api, 'gitFetch').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitPush').mockResolvedValue({ ok: true })
    vi.mocked(api.gitStatus).mockResolvedValue({ ...dirtyStatus, ahead: 1 })
    vi.mocked(api.gitLog).mockResolvedValue([{ ...logEntry, subject: 'WIP', refs: 'HEAD -> main' }])
    const buttons = (labels: string[]): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => labels.some(label => (button.textContent?.trim() ?? '').startsWith(label)))
    const { container, root } = renderGitView()
    try {
      await flush()
      await act(async () => { buttons(['Sync', '同步'])[0]!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitFetch).toHaveBeenCalledTimes(1)
      expect(api.gitPush).not.toHaveBeenCalled()
      expect(document.body.textContent).toMatch(/Push WIP commit|推送 WIP 提交/)

      await act(async () => { buttons(['Push anyway', '仍然推送'])[0]!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitPush).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('fast-forwards without asking when sync finds the remote ahead and nothing local to push', async () => {
    vi.spyOn(api, 'gitFetch').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitPush').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitRebase').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitFastForward').mockResolvedValue({ ok: true })
    vi.mocked(api.gitStatus).mockResolvedValueOnce(dirtyStatus).mockResolvedValue({ ...dirtyStatus, behind: 2 })
    const buttons = (labels: string[]): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => labels.some(label => (button.textContent?.trim() ?? '').startsWith(label)))
    const { container, root } = renderGitView()
    try {
      await flush()
      await act(async () => { buttons(['Sync', '同步'])[0]!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitFastForward).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' })
      expect(api.gitRebase).not.toHaveBeenCalled()
      expect(api.gitPush).not.toHaveBeenCalled()
      expect(document.body.textContent).not.toMatch(/Remote has new commits|远端有新提交/)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('offers to rebase onto the upstream when sync finds the remote ahead, then pushes', async () => {
    vi.spyOn(api, 'gitFetch').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitPush').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'gitRebase').mockResolvedValue({ ok: true })
    // Before the fetch the panel sees nothing behind; the fetch reveals 3 remote commits.
    vi.mocked(api.gitStatus).mockResolvedValueOnce({ ...dirtyStatus, ahead: 1 }).mockResolvedValue({ ...dirtyStatus, ahead: 1, behind: 3 })
    const buttons = (labels: string[]): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => labels.some(label => (button.textContent?.trim() ?? '').startsWith(label)))
    const { container, root } = renderGitView()
    try {
      await flush()
      await act(async () => { buttons(['Sync', '同步'])[0]!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitPush).not.toHaveBeenCalled()
      expect(document.body.textContent).toMatch(/3 commit|3 个提交/)

      await act(async () => { buttons(['Rebase and push', '变基并推送'])[0]!.click(); await Promise.resolve() })
      await flush()
      expect(api.gitRebase).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, '@{upstream}')
      expect(api.gitPush).toHaveBeenCalledTimes(1)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  it('pops the clicked entry from its row menu', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      expandSection(container, 'git-stash-entries')
      const row = container.querySelector<HTMLButtonElement>('[id^="git-stash-entries-"] button')!
      await act(async () => { row.click(); await Promise.resolve() })
      const pop = menuItem('Pop')
      expect(pop).toBeDefined()
      await act(async () => { pop!.click(); await Promise.resolve() })
      await flush()

      expect(api.gitStashPop).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, 'stash@{0}')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })
})

/** The stash section element (the block that owns the entry list). */
function stashSection(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[id^="git-stash-entries-"]')!.parentElement!
}

describe('GitView stash errors', () => {
  // WHY: an error about a stash lands next to the stash section; down by the
  // commit box it reads as a commit failure and is easy to miss entirely.
  it('reports a failed pop inside the stash section, not the commit box', async () => {
    vi.mocked(api.gitStashPop).mockRejectedValueOnce(new Error('pop conflicted'))
    const { container, root } = renderGitView()
    try {
      await flush()
      expandSection(container, 'git-tag-entries')
      expandSection(container, 'git-stash-entries')
      const row = container.querySelector<HTMLButtonElement>('[id^="git-stash-entries-"] button')!
      await act(async () => { row.click(); await Promise.resolve() })
      await act(async () => { menuItem('Pop')!.click(); await Promise.resolve() })
      await flush()

      const shown = [...container.querySelectorAll('[class*="gitError"]')]
        .filter(node => node.textContent?.includes('pop conflicted'))
      expect(shown).toHaveLength(1)
      expect(stashSection(container).contains(shown[0]!)).toBe(true)

      // A later successful stash clears it.
      openMoreMenu()
      await act(async () => { stashSaveButton().click(); await Promise.resolve() })
      await flush()
      expect(container.textContent).not.toContain('pop conflicted')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })
})

/** A button by either locale's label (the suite runs under whichever is active). */
function labelledButton(en: string, zh: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.textContent?.trim() === en || button.textContent?.trim() === zh)!
}

/** The tag section element (the block that owns the tag list). */
function tagSection(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[id^="git-tag-entries-"]')!.parentElement!
}

function tagInput(placeholderPart: string): HTMLInputElement {
  return [...document.querySelectorAll<HTMLInputElement>('input')]
    .find(input => input.placeholder.includes(placeholderPart))!
}

/** Type into a controlled React input (the value setter is on the prototype). */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('GitView tags', () => {
  it('lists tags newest first with their count and subject', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      expandSection(container, 'git-tag-entries')
      expect(container.textContent).toMatch(/Tag\s*2/)
      const rows = [...container.querySelectorAll('[id^="git-tag-entries-"] button')].map(node => node.textContent ?? '')
      expect(rows[0]).toContain('v0.2.0')
      expect(rows[0]).toContain('second release')
      expect(rows[1]).toContain('v0.1.0')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  // WHY: the message field is what decides lightweight vs annotated. An empty
  // message must reach the host as "no message", not as an empty annotation.
  it('creates a lightweight tag on HEAD from the section header', async () => {
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      act(() => { labelledButton('New tag…', '新建 Tag…').click() })
      const create = labelledButton('Create', '创建')
      expect(create.disabled).toBe(true)

      typeInto(tagInput('v1.2.0'), 'v1.0.0')
      await act(async () => { labelledButton('Create', '创建').click(); await Promise.resolve() })
      await flush()

      expect(api.gitTagCreate).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, 'v1.0.0', '', undefined)
      expect(api.gitTags).toHaveBeenCalledTimes(2)
      expect(tagInput('v1.2.0')).toBeUndefined()
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  // WHY: the whole point of the history entry is tagging a commit that is not
  // HEAD; losing the hash would silently tag the latest commit instead.
  it('creates an annotated tag on the right-clicked commit', async () => {
    vi.mocked(api.gitLog).mockResolvedValue([logEntry])
    const { container, root } = renderGitView()
    try {
      await flush()
      const row = container.querySelector<HTMLElement>('[class*="gitLogRow"]')!
      act(() => { row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })) })
      const entry = menuItem('Create tag…') ?? menuItem('创建 Tag…')
      expect(entry).toBeDefined()
      act(() => { entry!.click() })
      expect(document.body.textContent).toContain('1a2b3c4')
      expect(document.body.textContent).toContain('older commit')

      typeInto(tagInput('v1.2.0'), 'v1.0.0')
      typeInto(tagInput('optional') ?? tagInput('选填'), 'release notes')
      await act(async () => { labelledButton('Create', '创建').click(); await Promise.resolve() })
      await flush()

      expect(api.gitTagCreate).toHaveBeenCalledWith(
        { sessionId: 'session-1', cwd: '/repo' }, 'v1.0.0', 'release notes', logEntry.hashFull,
      )
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  // WHY: a rejected name is the common case (git's ref rules are strict), and
  // closing the dialog would throw away the message the user just wrote.
  it('keeps the create dialog open and its input intact when the host rejects the name', async () => {
    vi.mocked(api.gitTagCreate).mockRejectedValueOnce(new Error('invalid tag name'))
    const { container, root } = renderGitView()
    try {
      await flush()
      openMoreMenu()
      act(() => { labelledButton('New tag…', '新建 Tag…').click() })
      typeInto(tagInput('v1.2.0'), 'bad name')
      await act(async () => { labelledButton('Create', '创建').click(); await Promise.resolve() })
      await flush()

      expect(document.body.textContent).toContain('invalid tag name')
      expect(tagInput('v1.2.0').value).toBe('bad name')
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })

  // WHY: a tag error belongs next to the tag section; by the commit box it
  // reads as a commit failure, exactly the mistake the stash section fixed.
  it('reports a failed push inside the tag section after confirming', async () => {
    vi.mocked(api.gitTagPush).mockRejectedValueOnce(new Error('remote rejected'))
    const { container, root } = renderGitView()
    try {
      await flush()
      expandSection(container, 'git-tag-entries')
      const row = container.querySelector<HTMLButtonElement>('[id^="git-tag-entries-"] button')!
      await act(async () => { row.click(); await Promise.resolve() })
      const push = menuItem('Push to remote') ?? menuItem('推送到远端')
      expect(push).toBeDefined()
      act(() => { push!.click() })
      // The confirm modal repeats the action label; the last one is its button.
      const confirm = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .filter(button => button.textContent?.trim() === 'Push to remote' || button.textContent?.trim() === '推送到远端')
        .at(-1)!
      await act(async () => { confirm.click(); await Promise.resolve() })
      await flush()

      expect(api.gitTagPush).toHaveBeenCalledWith({ sessionId: 'session-1', cwd: '/repo' }, 'v0.2.0')
      const shown = [...container.querySelectorAll('[class*="gitError"]')]
        .filter(node => node.textContent?.includes('remote rejected'))
      expect(shown).toHaveLength(1)
      expect(tagSection(container).contains(shown[0]!)).toBe(true)
    } finally {
      act(() => { root.unmount() })
      container.remove()
    }
  })
})

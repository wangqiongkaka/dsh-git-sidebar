// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { apply } from '../src/client/index.tsx'
import { api, SidebarApiError, type SessionScope } from '../src/client/api.ts'
import type { SidebarTab } from '../src/client/state.ts'

const view = vi.hoisted(() => ({ props: undefined as undefined | { scope: SessionScope; onOpenWorktree(path: string): Promise<void>; onOpenDiff(tab: SidebarTab): void } }))
vi.mock('../src/client/GitView.tsx', () => ({ GitView: (props: typeof view.props) => { view.props = props; return null } }))
vi.mock('../src/client/DiffTab.tsx', () => ({ DiffTab: ({ diff }: { diff: { path?: string } }) => <div>{diff.path}</div> }))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const disposers: Array<() => void> = []
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose()
  vi.restoreAllMocks()
})
const effect = (run: () => void | (() => void)) => { const dispose = run(); if (typeof dispose === 'function') disposers.push(dispose) }
const emptyWorkspaces = { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => {} } }

describe('right sidebar guide card', () => {
  it('names the plugin that provides it and opens the Git tab in place', () => {
    const cards: Array<{ key?: string; component: ComponentType<Record<string, unknown>> }> = []
    const ctx = {
      sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      workspaces: emptyWorkspaces,
      slots: {
        inject: (_name: string, register: () => () => void) => register(),
        register(options: { name: string; key?: string }, component: ComponentType<Record<string, unknown>>) {
          if (options.name === 'sidebar.right.tab.guide.entry') cards.push({ key: options.key, component })
          return () => {}
        },
      },
    }
    apply(ctx as never)
    expect(cards.map(card => card.key)).toEqual(['dsh-git-sidebar'])
    const opened: unknown[] = []
    const props = { kind: 'dsh-git', title: '源代码管理', description: '查看变更、提交并同步分支',
      useTabInfo: () => ({ tab: { actions: { openTab: (...args: unknown[]) => opened.push(args) } } }) }
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => { root.render(createElement(cards[0]!.component, props)) })
    expect(host.textContent).toContain('源代码管理')
    expect(host.textContent).toContain('查看变更、提交并同步分支')
    expect(host.textContent).toContain('由 dsh-git-sidebar 插件提供')
    act(() => { host.querySelector<HTMLButtonElement>('[data-sidebar-right-guide-entry="dsh-git"]')!.click() })
    act(() => { root.unmount() })
    expect(opened).toEqual([['dsh-git', { replaceTab: true }]])
  })
})

describe('Git view actions', () => {
  it('switches the current session directory without creating sessions or changing the original project', async () => {
    const bodies = new Map<string, ComponentType<Record<string, unknown>>>()
    const switchDirectory = vi.spyOn(api, 'gitWorktreeOpen').mockImplementation(async (_scope, path) => ({ path }))
    const byId = {
      current: { id: 'current', cwd: '/repo', projectionValues: {} as Record<string, unknown> },
      old: { id: 'old', cwd: '/repo/wt-old' },
      fresh: { id: 'fresh', cwd: '/repo' },
    }
    const createSession = vi.fn()
    const createWorkspace = vi.fn()
    const openSession = vi.fn()
    const ctx = {
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      sessions: { list: { getSnapshot: () => ({ byId }) }, create: createSession },
      workspaces: { ...emptyWorkspaces, create: createWorkspace },
      uiWorkspace: { openSession },
      slots: {
        inject: (_name: string, register: () => () => void) => register(),
        register(options: { name: string; key?: string }, component: ComponentType<Record<string, unknown>>) {
          if (options.name === 'sidebar.right.pane.tab' && options.key) bodies.set(options.key, component)
          return () => {}
        },
      },
    }
    apply(ctx as never)
    const host = document.createElement('div')
    const root = createRoot(host)
    const render = (sessionId = 'current') => act(() => {
      root.render(createElement(bodies.get('dsh-git-sidebar')!, {
        sessionId, useSessions: (select: (state: { byId: typeof byId }) => unknown) => select({ byId }),
        useTabInfo: () => ({ tab: { actions: {} } }),
      }))
    })
    render()
    expect(view.props!.scope).toEqual({ sessionId: 'current', cwd: '/repo' })
    act(() => { view.props!.onOpenDiff({ id: 'diff:w:u:a.ts', type: 'diff', title: 'a.ts', diff: { kind: 'worktree', path: 'a.ts', staged: false } }) })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('a.ts')
    act(() => { dialog!.querySelector<HTMLButtonElement>('button[aria-label="关闭"]')!.click() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    act(() => { view.props!.onOpenDiff({ id: 'diff:w:u:a.ts', type: 'diff', title: 'a.ts', diff: { kind: 'worktree', path: 'a.ts', staged: false } }) })
    await act(async () => { await view.props!.onOpenWorktree('/repo/wt-old') })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(switchDirectory).toHaveBeenCalledWith({ sessionId: 'current', cwd: '/repo' }, '/repo/wt-old')
    byId.current.projectionValues.workingDirectory = '/repo/wt-old'
    render()
    expect(view.props!.scope).toEqual({ sessionId: 'current', cwd: '/repo/wt-old' })
    expect(byId.current.cwd).toBe('/repo')
    render('fresh')
    expect(view.props!.scope).toEqual({ sessionId: 'fresh', cwd: '/repo' })
    render()
    expect(view.props!.scope.cwd).toBe('/repo/wt-old')
    switchDirectory.mockRejectedValueOnce(new SidebarApiError('method-error', 'unavailable'))
    await expect(view.props!.onOpenWorktree('/repo/wt-new')).rejects.toThrow('当前 DSH 版本不支持切换会话工作目录')
    switchDirectory.mockRejectedValueOnce(new Error('directory unavailable'))
    await expect(view.props!.onOpenWorktree('/repo/wt-new')).rejects.toThrow('directory unavailable')
    expect(createSession).not.toHaveBeenCalled()
    expect(createWorkspace).not.toHaveBeenCalled()
    expect(openSession).not.toHaveBeenCalled()
    act(() => { root.unmount() })
  })
})

describe('Workspace Worktree icon', () => {
  it('marks linked Workspace folders after host rerenders without changing Session icons', async () => {
    vi.spyOn(api, 'gitWorktreeLinked').mockImplementation(async path => path === '/linked' ? { linked: true, main: '/main' } : { linked: false })
    const items = [
      { workspaceId: 'linked', path: '/linked' },
      { workspaceId: 'regular', path: '/regular' },
    ]
    const registered: string[] = []
    const ctx = {
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      workspaces: { list: { getSnapshot: () => ({ items }), subscribe: () => () => {} } },
      slots: {
        inject: (_name: string, register: () => () => void) => register(),
        register(options: { name: string }) { registered.push(options.name); return () => {} },
      },
    }
    const host = document.createElement('div')
    const workspaceRow = (id: string) => {
      const row = document.createElement('div')
      row.dataset.rowKey = `workspace:${id}`
      row.innerHTML = '<span><svg></svg></span><span>name</span>'
      return row
    }
    const linked = workspaceRow('linked')
    const regular = workspaceRow('regular')
    const session = document.createElement('div')
    session.dataset.rowKey = 'session:one'
    session.innerHTML = '<span data-harness-icon=""></span>'
    host.append(linked, regular, session)
    document.body.append(host)
    try {
      apply(ctx as never)
      await vi.waitFor(() => { expect(linked.firstElementChild?.hasAttribute('data-git-worktree-folder')).toBe(true) })
      expect(regular.firstElementChild?.hasAttribute('data-git-worktree-folder')).toBe(false)
      expect(session.querySelector('[data-harness-icon]')).not.toBeNull()
      expect(registered).not.toContain('sidebar.session.row.leading')
      const replacement = workspaceRow('linked')
      linked.replaceWith(replacement)
      await vi.waitFor(() => { expect(replacement.firstElementChild?.hasAttribute('data-git-worktree-folder')).toBe(true) })
      for (const dispose of disposers.splice(0).reverse()) dispose()
      expect(replacement.firstElementChild?.hasAttribute('data-git-worktree-folder')).toBe(false)
    } finally {
      host.remove()
    }
  })

  it('orders Worktree groups right after their main checkout group and indents them', async () => {
    vi.spyOn(api, 'gitWorktreeLinked').mockImplementation(async path =>
      path.startsWith('/repo-') ? { linked: true, main: '/repo' } : { linked: false })
    const items = ['repo', 'repo-01', 'repo-02', 'other', 'folder', 'repo-03'].map(id => ({ workspaceId: id, path: `/${id}` }))
    const ctx = {
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      workspaces: { list: { getSnapshot: () => ({ items }), subscribe: () => () => {} } },
      slots: { inject: (_name: string, register: () => () => void) => register(), register: () => () => {} },
    }
    // The host's group: a header row (wrapped like its hover card anchor) followed by its Session rows.
    const section = (id: string) => {
      const group = document.createElement('div')
      group.innerHTML = `<span><div data-row-key="workspace:${id}"><span><svg></svg></span></div></span><div data-row-key="session:${id}"></div>`
      return group
    }
    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    const [wt1, other, repo, wt2, folder] = [section('repo-01'), section('other'), section('repo'), section('repo-02'), section('folder')]
    // The host's tree view nests a group inside an unrelated ancestor; that group stays where the host put it.
    const nestedByHost = section('repo-03')
    folder.append(nestedByHost)
    tree.append(wt1, other, repo, wt2, folder)
    document.body.append(tree)
    try {
      apply(ctx as never)
      await vi.waitFor(() => { expect(wt1.hasAttribute('data-git-worktree-child')).toBe(true) })
      expect(tree.hasAttribute('data-git-worktree-tree')).toBe(true)
      expect([wt1, other, repo, wt2, folder].map(group => group.style.order)).toEqual(['5', '2', '4', '5', '8'])
      expect(wt2.hasAttribute('data-git-worktree-child')).toBe(true)
      expect(nestedByHost.hasAttribute('data-git-worktree-child')).toBe(false)
      expect(nestedByHost.style.order).toBe('')
      // The host moves the main checkout's group to the top; its Worktrees follow.
      tree.prepend(repo)
      await vi.waitFor(() => { expect(repo.style.order).toBe('0') })
      expect([wt1, other, wt2].map(group => group.style.order)).toEqual(['1', '4', '1'])
      for (const dispose of disposers.splice(0).reverse()) dispose()
      expect(tree.hasAttribute('data-git-worktree-tree')).toBe(false)
      expect([wt1, other, repo, wt2, folder].map(group => group.style.order)).toEqual(['', '', '', '', ''])
      expect(wt1.hasAttribute('data-git-worktree-child')).toBe(false)
    } finally {
      tree.remove()
    }
  })

  it('folds a main checkout once on load, hiding its Worktree groups until the user unfolds it', async () => {
    vi.spyOn(api, 'gitWorktreeLinked').mockImplementation(async path =>
      path.startsWith('/repo-') ? { linked: true, main: '/repo' } : { linked: false })
    const items = ['repo', 'repo-01', 'repo-02', 'other'].map(id => ({ workspaceId: id, path: `/${id}` }))
    const ctx = {
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      workspaces: { list: { getSnapshot: () => ({ items }), subscribe: () => () => {} } },
      slots: { inject: (_name: string, register: () => () => void) => register(), register: () => () => {} },
    }
    // The host's group header toggles its own aria-expanded on a click, as ui-workspace does.
    const section = (id: string) => {
      const group = document.createElement('div')
      group.innerHTML = `<span><div data-row-key="workspace:${id}" role="treeitem" aria-expanded="true"><span><svg></svg></span></div></span>`
      const row = group.querySelector<HTMLElement>('[data-row-key]')!
      row.addEventListener('click', () => { row.setAttribute('aria-expanded', String(row.getAttribute('aria-expanded') !== 'true')) })
      return group
    }
    const tree = document.createElement('div')
    tree.setAttribute('role', 'tree')
    const [repo, wt1, wt2, other] = [section('repo'), section('repo-01'), section('repo-02'), section('other')]
    tree.append(repo, wt1, wt2, other)
    document.body.append(tree)
    const row = (group: HTMLElement) => group.querySelector<HTMLElement>('[data-row-key]')!
    try {
      apply(ctx as never)
      await vi.waitFor(() => { expect(wt1.hidden).toBe(true) })
      expect(row(repo).getAttribute('aria-expanded')).toBe('false')
      expect(wt2.hidden).toBe(true)
      expect(other.hidden).toBe(false)
      expect(repo.hasAttribute('data-git-worktree-open')).toBe(false)
      expect(wt2.hasAttribute('data-git-worktree-last')).toBe(true)
      expect(wt1.hasAttribute('data-git-worktree-last')).toBe(false)
      // Unfolding shows the Worktrees under it and stays unfolded across redraws.
      row(repo).click()
      await vi.waitFor(() => { expect(wt1.hidden).toBe(false) })
      expect(wt2.hidden).toBe(false)
      expect(repo.hasAttribute('data-git-worktree-open')).toBe(true)
      tree.append(section('later'))
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(row(repo).getAttribute('aria-expanded')).toBe('true')
      // Folding again hides them again.
      row(repo).click()
      await vi.waitFor(() => { expect(wt1.hidden).toBe(true) })
      for (const dispose of disposers.splice(0).reverse()) dispose()
      expect([wt1.hidden, wt2.hidden]).toEqual([false, false])
      expect(wt2.hasAttribute('data-git-worktree-last')).toBe(false)
    } finally {
      tree.remove()
    }
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { apply } from '../src/client/index.tsx'
import { api } from '../src/client/api.ts'
import type { SidebarTab } from '../src/client/state.ts'

const view = vi.hoisted(() => ({ props: undefined as undefined | { onOpenWorktree(path: string): Promise<void>; onOpenDiff(tab: SidebarTab): void } }))
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
  it('opens worktree sessions and displays a diff in a dismissible modal', async () => {
    const bodies = new Map<string, ComponentType<Record<string, unknown>>>()
    const opened: string[] = []
    const byId = { old: { id: 'old', cwd: '/repo/wt-old', origin: 'user' }, sub: { id: 'sub', cwd: '/repo/wt-new', origin: 'subagent' } }
    const ctx = {
      effect,
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      sessions: { list: { getSnapshot: () => ({ byId }) }, create: async () => 'created' },
      workspaces: { ...emptyWorkspaces, create: async ({ path }: { path: string }) => ({ workspaceId: `ws:${path}` }) },
      uiWorkspace: { openSession: (id: string) => { opened.push(id) } },
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
    act(() => {
      root.render(createElement(bodies.get('dsh-git-sidebar')!, {
        sessionId: 'old', useSessions: (select: (state: { byId: typeof byId }) => unknown) => select({ byId }),
        useTabInfo: () => ({ tab: { actions: {} } }),
      }))
    })
    await view.props!.onOpenWorktree('/repo/wt-old')
    await view.props!.onOpenWorktree('/repo/wt-new')
    expect(opened).toEqual(['old', 'created'])
    act(() => { view.props!.onOpenDiff({ id: 'diff:w:u:a.ts', type: 'diff', title: 'a.ts', diff: { kind: 'worktree', path: 'a.ts', staged: false } }) })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('a.ts')
    act(() => { dialog!.querySelector<HTMLButtonElement>('button[aria-label="关闭"]')!.click() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    act(() => { root.unmount() })
  })
})

describe('Workspace Worktree icon', () => {
  it('marks linked Workspace folders after host rerenders without changing Session icons', async () => {
    vi.spyOn(api, 'gitWorktreeLinked').mockImplementation(async path => ({ linked: path === '/linked' }))
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
})

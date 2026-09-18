// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { apply } from '../src/client/index.tsx'

const view = vi.hoisted(() => ({ props: undefined as undefined | { onOpenWorktree(path: string): Promise<void> } }))
vi.mock('../src/client/GitView.tsx', () => ({ GitView: (props: typeof view.props) => { view.props = props; return null } }))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('right sidebar guide card', () => {
  it('names the plugin that provides it and opens the Git tab in place', () => {
    const cards: Array<{ key?: string; component: ComponentType<Record<string, unknown>> }> = []
    const ctx = {
      sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
      effect(fn: () => unknown) { fn() },
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
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

describe('Git view worktree action', () => {
  it('opens an existing or newly created worktree session through the workspace UI', async () => {
    const bodies = new Map<string, ComponentType<Record<string, unknown>>>()
    const opened: string[] = []
    const byId = { old: { id: 'old', cwd: '/repo/wt-old', origin: 'user' }, sub: { id: 'sub', cwd: '/repo/wt-new', origin: 'subagent' } }
    const ctx = {
      effect(fn: () => unknown) { fn() },
      locale: { register: () => () => {}, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
      sidebarRightTabs: { register: () => () => {} },
      sessions: { list: { getSnapshot: () => ({ byId }) }, create: async () => 'created' },
      workspaces: { create: async ({ path }: { path: string }) => ({ workspaceId: `ws:${path}` }) },
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
    act(() => { root.unmount() })
  })
})

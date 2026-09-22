/** Register Git and per-change diff tabs with the built-in right sidebar. */
import { useMemo, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { GitView } from './GitView.tsx'
import { DiffTab } from './DiffTab.tsx'
import { api } from './api.ts'
import { attachLocale, en, LOCALE_NS, t, zh } from './locales.ts'
import { diffAddress, parseDiffAddress, diffTitle } from './navigation.ts'
import css from './sidebar.module.css'

export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sessions', 'workspaces', 'uiWorkspace']

/** Mount independent views; every registration is released on plugin unload. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }))
  ctx.effect(() => {
    attachLocale(ctx.locale)
    return () => { attachLocale(undefined) }
  })
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-git-sidebar', kind: 'dsh-git', title: () => t('git'),
    guide: [{ id: 'git', order: 20, title: () => t('git'), description: () => t('gitGuideDesc'), icon: IconBranchOutlineRegular }],
  }))
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-git-sidebar/diff', kind: 'dsh-git-diff',
    patterns: ['dsh-resource://git-diff/**'],
    canOpen: address => parseDiffAddress(address) !== undefined,
    title: address => diffTitle(parseDiffAddress(address)!.diff),
  }))
  const useLanguage = () => useSyncExternalStore(
    listener => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot().active,
  )
  function GitBody({ sessionId, useSessions, useTabInfo }: PropsRuntime<'sidebar.right.pane.tab'>) {
    useLanguage()
    const cwd = useSessions(state => state.byId[sessionId]?.cwd)
    const { tab } = useTabInfo()
    const scope = { sessionId, cwd }
    return <GitView
      scope={scope}
      onOpenDiff={seed => { if (seed.diff !== undefined) tab.actions.openResource(diffAddress(sessionId, seed.diff)) }}
      onOpenFile={async path => {
        const result = await api.gitPath(scope, path)
        tab.actions.openResource(sessionFileAddress(sessionId, result.path))
      }}
      onPrompt={async text => {
        const scoped = ctx.sessions.scope(sessionId)
        const session = scoped === undefined ? undefined : ctx.sessions.sessionOf(scoped)
        if (session === undefined) throw new Error('session unavailable')
        const handle = session.beginSubmission({ mode: 'queue', text, attachments: [] })
        const result = await session.prompt([{ type: 'text', text }], 'queue', undefined, handle.requestId)
        if (!result.ok) throw new Error(result.error.message)
      }}
      onOpenWorktree={async path => {
        const existing = Object.values(ctx.sessions.list.getSnapshot().byId).find(session => session.cwd === path && session.origin !== 'subagent')
        if (existing !== undefined) { ctx.uiWorkspace.openSession(existing.id); return }
        const workspace = await ctx.workspaces.create({ path })
        const id = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
        ctx.uiWorkspace.openSession(id)
      }}
    />
  }
  function DiffBody({ sessionId, useSessions, useTabInfo }: PropsRuntime<'sidebar.right.pane.tab'>) {
    useLanguage()
    const cwd = useSessions(state => state.byId[sessionId]?.cwd)
    const { tab } = useTabInfo()
    const value = useMemo(() => parseDiffAddress(tab.navigation.address), [tab.navigation.address])
    if (value === undefined || value.sessionId !== sessionId) return <p>{t('diffLoadError')}</p>
    return <DiffTab sessionId={sessionId} cwd={cwd} diff={value.diff} />
  }
  // The guide's card for this tab: the host's capsule, plus the plugin that provides it.
  function GuideEntry({ kind, title, description, useTabInfo }: PropsRuntime<'sidebar.right.tab.guide.entry'>) {
    useLanguage()
    const { tab } = useTabInfo()
    return <button type="button" className={css.guideEntry} data-sidebar-right-guide-entry={kind}
      onClick={() => { tab.actions.openTab(kind, { replaceTab: true }) }}>
      <span className={css.guideIcon}><IconBranchOutlineRegular size={description === undefined ? 22 : 26} /></span>
      <span className={css.guideText}>
        <span className={css.guideRow}>
          <span className={css.guideTitle}>{title}</span>
          <span className={css.guideLine}>{t('providedBy')}</span>
        </span>
        {description !== undefined && <span className={css.guideLine}>{description}</span>}
      </span>
    </button>
  }
  function GitTitle() { useLanguage(); return <><IconBranchOutlineRegular size={16} /> {t('git')}</> }
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: 'dsh-git-sidebar' }, GitBody,
  )))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: 'dsh-git-sidebar/diff' }, DiffBody,
  )))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: 'dsh-git-sidebar' }, GitTitle,
  )))
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.guide.entry', () => ctx.slots.register(
    { name: 'sidebar.right.tab.guide.entry', key: 'dsh-git-sidebar' }, GuideEntry,
  )))
}

import { afterEach, expect, it, vi } from 'vitest'
import { attachLocale, relativeTime } from '../src/client/locales.ts'

afterEach(() => {
  attachLocale(undefined)
  vi.restoreAllMocks()
})

it('shows older commits as relative time in both locales', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-30T12:00:00Z'))
  attachLocale({ getSnapshot: () => ({ active: 'zh' }) })
  expect(relativeTime('2026-09-30T11:55:00Z')).toBe('5 分钟前')
  expect(relativeTime('2026-09-27T12:00:00Z')).toBe('3 天前')
  expect(relativeTime('2026-08-16T12:00:00Z')).toBe('1 个月前')
  expect(relativeTime('2025-08-26T12:00:00Z')).toBe('1 年前')
  attachLocale({ getSnapshot: () => ({ active: 'en' }) })
  expect(relativeTime('2026-09-27T12:00:00Z')).toBe('3 days ago')
})

it('parses Git author dates on browsers that reject the space-separated form', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-30T12:36:17Z'))
  const parse = Date.parse.bind(Date)
  vi.spyOn(Date, 'parse').mockImplementation(value => value.includes(' ') ? NaN : parse(value))
  attachLocale({ getSnapshot: () => ({ active: 'zh' }) })
  expect(relativeTime('2026-09-30 20:31:17 +0800')).toBe('5 分钟前')
})

import { describe, expect, it } from 'vitest'
import { diffAddress, parseDiffAddress } from '../src/client/navigation.ts'

describe('native sidebar diff addresses', () => {
  it('preserves special paths and separates sessions, index sides, and commits', () => {
    const diff = { kind: 'worktree', path: '目录/a #?%.ts', staged: false, untracked: true } as const
    const address = diffAddress('session/one', diff)
    expect(parseDiffAddress(address)).toEqual({ sessionId: 'session/one', diff })
    expect(diffAddress('two', diff)).not.toBe(address)
    expect(diffAddress('session/one', { ...diff, staged: true })).not.toBe(address)
    const commit = { kind: 'commit', hash: 'abc1234', hashFull: 'a'.repeat(40), subject: 'fix / path' } as const
    expect(parseDiffAddress(diffAddress('one', commit))?.diff).toEqual(commit)
  })
  it('rejects corrupt or foreign addresses', () => {
    for (const address of ['sidebar://guide', 'dsh-resource://git-diff/s/%', 'dsh-resource://git-diff/s/null',
      diffAddress('s', { kind: 'commit', hash: 'bad', hashFull: '--stat', subject: '' })]) {
      expect(parseDiffAddress(address)).toBeUndefined()
    }
  })
})

import { describe, expect, it } from 'vitest'
import { layoutGraph } from '../src/client/graph.ts'

describe('layoutGraph', () => {
  it('keeps a linear history in one lane', () => {
    const { rows, lanes } = layoutGraph([
      { hashFull: 'c', parents: ['b'] },
      { hashFull: 'b', parents: ['a'] },
      { hashFull: 'a', parents: [] },
    ])
    expect(lanes).toBe(1)
    expect(rows.map(row => row.lane)).toEqual([0, 0, 0])
    expect(rows.map(row => row.incoming)).toEqual([false, true, true])
    expect(rows[2]!.parents).toEqual([])
  })

  it('opens a lane for a merge parent and joins it back at the fork point', () => {
    // m merges f (side branch) into b; both descend from a.
    const { rows, lanes } = layoutGraph([
      { hashFull: 'm', parents: ['b', 'f'] },
      { hashFull: 'f', parents: ['a'] },
      { hashFull: 'b', parents: ['a'] },
      { hashFull: 'a', parents: [] },
    ])
    expect(lanes).toBe(2)
    expect(rows[0]).toEqual({ lane: 0, incoming: false, through: [], joins: [], parents: [0, 1] })
    expect(rows[1]).toEqual({ lane: 1, incoming: true, through: [0], joins: [], parents: [1] })
    expect(rows[2]).toEqual({ lane: 0, incoming: true, through: [1], joins: [], parents: [0] })
    expect(rows[3]).toEqual({ lane: 0, incoming: true, through: [], joins: [1], parents: [] })
  })

  it('places an unrelated branch head in a free lane', () => {
    const { rows } = layoutGraph([
      { hashFull: 'x', parents: ['a'] },
      { hashFull: 'y', parents: ['a'] },
      { hashFull: 'a', parents: [] },
    ])
    expect(rows.map(row => row.lane)).toEqual([0, 1, 0])
    expect(rows[2]!.joins).toEqual([1])
  })
})

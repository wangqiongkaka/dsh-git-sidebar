/**
 * Commit-graph lane layout (the "git log --graph" rails) computed on the
 * client from each row's parent hashes. Lanes are stable slots: a lane is
 * freed (set to null) when its expected commit is drawn or joins another
 * lane, and a new branch reuses the first free slot, so pass-through rails
 * stay vertical and only the commit's own edges bend.
 */

/** Everything one history row needs to paint its graph cell. */
export interface GraphRow {
  /** Lane of the commit node. */
  lane: number
  /** Whether a rail from the row above ends at this node (false for a branch tip). */
  incoming: boolean
  /** Lanes that pass straight through this row (excluding the commit lane). */
  through: number[]
  /** Lanes that expected this commit and merge into it from above. */
  joins: number[]
  /** Lanes the commit's parents continue in (first parent first). */
  parents: number[]
}

/** Lay out rows (newest first) into lanes; `parents` are full hashes. */
export function layoutGraph(rows: { hashFull: string; parents: string[] }[]): { rows: GraphRow[]; lanes: number } {
  const lanes: (string | null)[] = []
  const out: GraphRow[] = []
  let width = 0
  const freeSlot = (): number => {
    const idx = lanes.indexOf(null)
    if (idx !== -1) return idx
    lanes.push(null)
    return lanes.length - 1
  }
  for (const row of rows) {
    const expecting = lanes.flatMap((hash, idx) => (hash === row.hashFull ? [idx] : []))
    const lane = expecting[0] ?? freeSlot()
    const joins = expecting.slice(1)
    for (const idx of joins) lanes[idx] = null
    const through = lanes.flatMap((hash, idx) => (hash !== null && idx !== lane ? [idx] : []))
    lanes[lane] = null
    const parentLanes: number[] = []
    row.parents.forEach((parent, order) => {
      // The first parent keeps the commit's own rail (a second lane already
      // expecting it joins there); merge parents ride an existing rail.
      const existing = order === 0 ? -1 : lanes.indexOf(parent)
      if (existing !== -1) {
        parentLanes.push(existing)
        return
      }
      const idx = order === 0 ? lane : freeSlot()
      lanes[idx] = parent
      parentLanes.push(idx)
    })
    width = Math.max(width, lanes.length, lane + 1)
    out.push({ lane, incoming: expecting.length > 0, through, joins, parents: parentLanes })
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
  }
  return { rows: out, lanes: width }
}

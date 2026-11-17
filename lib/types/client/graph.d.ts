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
    lane: number;
    /** Whether a rail from the row above ends at this node (false for a branch tip). */
    incoming: boolean;
    /** Lanes that pass straight through this row (excluding the commit lane). */
    through: number[];
    /** Lanes that expected this commit and merge into it from above. */
    joins: number[];
    /** Lanes the commit's parents continue in (first parent first). */
    parents: number[];
}
/** Lay out rows (newest first) into lanes; `parents` are full hashes. */
export declare function layoutGraph(rows: {
    hashFull: string;
    parents: string[];
}[]): {
    rows: GraphRow[];
    lanes: number;
};

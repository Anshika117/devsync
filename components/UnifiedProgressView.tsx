import type {
  DifficultyCounts,
  TagBreakdownRow,
  LeetCodeContestRating,
  CodeforcesRating,
} from "@/lib/unifiedProfile"

interface Props {
  leetcodeSyncedCount: number
  codeforcesSyncedCount: number
  leetcodeActual: DifficultyCounts | null
  tagBreakdown: TagBreakdownRow[]
  leetcodeContestRating: LeetCodeContestRating | null
  codeforcesRating: CodeforcesRating | null
}

// Deliberately not another expandable list/dropdown like the rest of the
// site (FolderGrid, ProblemList) — this is meant to be read at a glance, so
// it's a stat header plus a per-topic bar visualization instead. No charting
// library added for this: two colored divs with a computed inline width is
// enough for a two-way split and keeps this consistent with the rest of the
// app's "native over dependency" choices (drag-and-drop, the hand-rolled
// worker pool in the sync routes).
export default function UnifiedProgressView({
  leetcodeSyncedCount,
  codeforcesSyncedCount,
  leetcodeActual,
  tagBreakdown,
  leetcodeContestRating,
  codeforcesRating,
}: Props) {
  const unifiedTotal = leetcodeSyncedCount + codeforcesSyncedCount
  const leetcodeBehind =
    leetcodeActual && leetcodeActual.total > leetcodeSyncedCount
      ? leetcodeActual.total - leetcodeSyncedCount
      : 0

  const topTags = tagBreakdown.filter((row) => row.combined.total > 0).slice(0, 12)
  const maxTotal = topTags[0]?.combined.total ?? 1

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-1">Unified Progress</h2>
      <p className="text-sm text-gray-400 mb-6">
        LeetCode and Codeforces combined, tags merged across both.
      </p>

      {/* Top stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-950 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Solved</p>
          <p className="text-3xl font-bold text-white">{unifiedTotal}</p>
          <p className="text-xs text-gray-500 mt-1">synced into DevSync</p>
        </div>

        <div className="bg-gray-950 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">LeetCode</p>
          <p className="text-3xl font-bold text-yellow-400">{leetcodeSyncedCount}</p>
          {leetcodeBehind > 0 ? (
            <p className="text-xs text-orange-400 mt-1">
              {leetcodeActual!.total} solved on LeetCode — {leetcodeBehind} not synced yet
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">up to date</p>
          )}
          {leetcodeContestRating ? (
            <p className="text-sm text-gray-300 mt-3 pt-3 border-t border-gray-800">
              Contest rating <span className="font-semibold text-yellow-300">{leetcodeContestRating.rating}</span>
              <span className="text-xs text-gray-500"> · top {leetcodeContestRating.topPercentage.toFixed(1)}%</span>
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-800">No rated contests yet</p>
          )}
        </div>

        <div className="bg-gray-950 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Codeforces</p>
          <p className="text-3xl font-bold text-blue-400">{codeforcesSyncedCount}</p>
          <p className="text-xs text-gray-500 mt-1">up to date</p>
          {codeforcesRating ? (
            <p className="text-sm text-gray-300 mt-3 pt-3 border-t border-gray-800">
              Rating <span className="font-semibold text-blue-300">{codeforcesRating.rating}</span>
              <span className="text-xs text-gray-500"> · {codeforcesRating.rank}</span>
              {codeforcesRating.maxRating > codeforcesRating.rating && (
                <span className="block text-xs text-gray-500">max {codeforcesRating.maxRating} ({codeforcesRating.maxRank})</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-800">No rating yet</p>
          )}
        </div>
      </div>

      {/* Per-topic bars */}
      {topTags.length === 0 ? (
        <p className="text-gray-500 text-sm">Sync a platform to see your topic breakdown.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {topTags.map((row) => {
            const lcPct = (row.leetcode.total / row.combined.total) * 100
            const cfPct = 100 - lcPct
            const widthPct = (row.combined.total / maxTotal) * 100

            return (
              <div key={row.tag}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-medium text-white">{row.tag}</span>
                  <span className="text-xs text-gray-500">
                    {row.combined.total} total
                    {row.leetcode.total > 0 && row.codeforces.total > 0
                      ? ` · ${row.leetcode.total} LC · ${row.codeforces.total} CF`
                      : ""}
                  </span>
                </div>
                <div
                  className="h-2.5 rounded-full bg-gray-800 overflow-hidden flex"
                  style={{ width: `${Math.max(widthPct, 8)}%` }}
                >
                  {row.leetcode.total > 0 && (
                    <div className="h-full bg-yellow-500" style={{ width: `${lcPct}%` }} />
                  )}
                  {row.codeforces.total > 0 && (
                    <div className="h-full bg-blue-500" style={{ width: `${cfPct}%` }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

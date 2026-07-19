import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { normalizeTag } from "@/lib/tagNormalizer"

const LC_GRAPHQL = "https://leetcode.com/graphql"
const LC_TOTALS_CACHE_TTL_S = 30 * 60 // 30 minutes

export interface DifficultyCounts {
  easy: number
  medium: number
  hard: number
  total: number
}

export interface TagBreakdownRow {
  tag: string
  leetcode: DifficultyCounts
  codeforces: DifficultyCounts
  combined: DifficultyCounts
}

function emptyCounts(): DifficultyCounts {
  return { easy: 0, medium: 0, hard: 0, total: 0 }
}

function addDifficulty(counts: DifficultyCounts, difficulty: string) {
  counts.total++
  if (difficulty === "Easy") counts.easy++
  else if (difficulty === "Medium") counts.medium++
  else if (difficulty === "Hard") counts.hard++
}

// Shared cache-aside wrapper for the three external-API fetchers below —
// they were each hand-rolling the same "check cache, fetch, cache on
// success, swallow errors as null" shape. Behavior is identical to before:
// a cache hit short-circuits the fetch entirely, a thrown error or a
// fetcher-returned null both fall through as null without ever being
// cached (so a transient failure doesn't get "stuck" for the TTL window).
async function withCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const cached = await redis.get<T>(cacheKey)
  if (cached) return cached

  try {
    const result = await fetcher()
    if (result !== null) await redis.set(cacheKey, result, { ex: ttlSeconds })
    return result
  } catch {
    return null
  }
}

// Problem.tags stores whatever a platform sent verbatim — LeetCode's Title
// Case ("Dynamic Programming") and Codeforces's own vocabulary ("dp") never
// get reconciled once solved problems are actually stored, only when a
// *folder* gets picked during sync (getPrimaryTag). Left alone, grouping by
// the raw tag string here would silently keep a LeetCode DP count and a
// Codeforces "dp" count as two separate topics instead of one combined
// number — the same class of bug normalizeTag() was originally built to fix
// for folder names, just never applied to this kind of aggregation before.
export async function getUnifiedTagBreakdown(userId: string): Promise<TagBreakdownRow[]> {
  const problems = await prisma.problem.findMany({
    where: { userId },
    select: { platform: true, tags: true, difficulty: true },
  })

  const rows = new Map<string, TagBreakdownRow>()

  for (const problem of problems) {
    const seenOnThisProblem = new Set<string>() // a tag appearing twice on one problem shouldn't double-count
    for (const rawTag of problem.tags) {
      const tag = normalizeTag(rawTag)
      if (seenOnThisProblem.has(tag)) continue
      seenOnThisProblem.add(tag)

      if (!rows.has(tag)) {
        rows.set(tag, {
          tag,
          leetcode: emptyCounts(),
          codeforces: emptyCounts(),
          combined: emptyCounts(),
        })
      }
      const row = rows.get(tag)!
      const bucket = problem.platform === "LeetCode" ? row.leetcode : row.codeforces
      addDifficulty(bucket, problem.difficulty)
      addDifficulty(row.combined, problem.difficulty)
    }
  }

  return Array.from(rows.values()).sort((a, b) => b.combined.total - a.combined.total)
}

// Real, platform-wide Easy/Medium/Hard totals straight from LeetCode's own
// stats — independent of how many of those problems have actually made it
// into DevSync's own sync (currently capped at the 50 most recent accepted
// submissions; see the sync route). Lets the dashboard show "synced vs
// actual" honestly instead of silently presenting a partial number as if it
// were the whole picture.
export async function getLeetCodeActualTotals(username: string): Promise<DifficultyCounts | null> {
  return withCache(`lc_totals:${username}`, LC_TOTALS_CACHE_TTL_S, async () => {
    const res = await fetch(LC_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query userProblemsSolved($username: String!) {
            matchedUser(username: $username) {
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username },
      }),
    })
    if (!res.ok) return null

    const data = await res.json()
    const nums = data?.data?.matchedUser?.submitStats?.acSubmissionNum as
      | { difficulty: string; count: number }[]
      | undefined
    if (!nums) return null

    const find = (d: string) => nums.find((n) => n.difficulty === d)?.count ?? 0
    return {
      easy: find("Easy"),
      medium: find("Medium"),
      hard: find("Hard"),
      total: find("All"),
    }
  })
}

export interface LeetCodeContestRating {
  rating: number
  globalRanking: number
  topPercentage: number
  attendedContestsCount: number
}

// LeetCode's contest rating lives under a separate query from submitStats —
// userContestRanking, not matchedUser — and comes back null (not an error)
// for anyone who's never entered a rated contest, which is the common case
// for someone who only grinds the practice problem set.
export async function getLeetCodeContestRating(username: string): Promise<LeetCodeContestRating | null> {
  return withCache(`lc_contest_rating:${username}`, LC_TOTALS_CACHE_TTL_S, async () => {
    const res = await fetch(LC_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query userContestRankingInfo($username: String!) {
            userContestRanking(username: $username) {
              attendedContestsCount
              rating
              globalRanking
              topPercentage
            }
          }
        `,
        variables: { username },
      }),
    })
    if (!res.ok) return null

    const data = await res.json()
    const ranking = data?.data?.userContestRanking
    if (!ranking) return null // no rated contests entered yet — not an error

    return {
      rating: Math.round(ranking.rating),
      globalRanking: ranking.globalRanking,
      topPercentage: ranking.topPercentage,
      attendedContestsCount: ranking.attendedContestsCount,
    }
  })
}

export interface CodeforcesRating {
  rating: number
  maxRating: number
  rank: string
  maxRank: string
}

// Codeforces's rank (e.g. "specialist", "expert") is a title derived from
// rating, returned directly by their API rather than something this app
// computes — simplest to just relay it, capitalized, rather than
// re-implementing CF's own rating-tier thresholds (which do occasionally
// shift) and risk disagreeing with what Codeforces itself would say.
export async function getCodeforcesRating(handle: string): Promise<CodeforcesRating | null> {
  return withCache(`cf_rating:${handle}`, LC_TOTALS_CACHE_TTL_S, async () => {
    const res = await fetch(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`
    )
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== "OK") return null

    const user = data.result?.[0]
    if (!user) return null

    const capitalize = (s: string) => s.replace(/\b\w/g, (c: string) => c.toUpperCase())
    return {
      rating: user.rating ?? 0,
      maxRating: user.maxRating ?? 0,
      rank: user.rank ? capitalize(user.rank) : "Unrated",
      maxRank: user.maxRank ? capitalize(user.maxRank) : "Unrated",
    }
  })
}

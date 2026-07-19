import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

const STATS_CACHE_TTL_S = 10 * 60 // 10 minutes

export interface DashboardStats {
  problemCount: number
  difficultyCounts: { Easy: number; Medium: number; Hard: number }
}

function statsCacheKey(userId: string) {
  return `dashboard_stats:${userId}`
}

// Problem count + Easy/Med/Hard breakdown for the dashboard's stat cards.
// Both are cheap, already-indexed reads on their own, but under concurrent
// traffic even a cheap read is a database round-trip a repeat page load
// didn't need to make. Cached in Redis, same pattern as
// syncNeedsRevisionFolder in lib/revisionEngine.ts — except this cache is
// invalidated explicitly (see invalidateDashboardStats below) rather than
// relying on the TTL alone, because stale counts right after a sync would
// directly contradict the sync feature's own "refresh in a few seconds"
// promise. The 10-minute TTL here is just a safety net in case an
// invalidation call is ever missed, not the primary freshness mechanism.
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const cacheKey = statsCacheKey(userId)
  const cached = await redis.get<DashboardStats>(cacheKey)
  if (cached) {
    return cached
  }

  const [problemCount, difficultyGroups] = await Promise.all([
    prisma.problem.count({ where: { userId } }),
    prisma.problem.groupBy({
      by: ["difficulty"],
      where: { userId },
      _count: { _all: true },
    }),
  ])

  const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 }
  for (const g of difficultyGroups) {
    if (g.difficulty in difficultyCounts) {
      difficultyCounts[g.difficulty as keyof typeof difficultyCounts] = g._count._all
    }
  }

  const stats: DashboardStats = { problemCount, difficultyCounts }
  await redis.set(cacheKey, stats, { ex: STATS_CACHE_TTL_S })
  return stats
}

// Called after anything that changes a user's problem count or difficulty
// mix — LeetCode/Codeforces sync and manual problem-add. Without this, a
// user who just synced would see last-cached (up to 10-minute-old) counts
// instead of what they were just told to expect.
export async function invalidateDashboardStats(userId: string) {
  await redis.del(statsCacheKey(userId))
}

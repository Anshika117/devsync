import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const NEEDS_REVISION_CACHE_TTL_S = 60 * 60 // 1 hour

function needsRevisionCacheKey(userId: string) {
  return `needs_revision:${userId}`
}

// A problem counts as "stale" one of two ways:
//
// 1. It has an SM-2 schedule (nextReviewAt set, because the user rated it
//    at least once via /api/problem/review) and that date has passed — this
//    is the precise, per-problem case.
// 2. It has never been rated via SM-2 at all (nextReviewAt is null), in
//    which case this falls back to the original flat heuristic: 30+ days
//    since lastViewedAt, or solvedAt, or createdAt in that fallback order.
//
// Same "fallback chain" philosophy as the original heuristic itself (see
// DECISIONS.md): a problem solved before SM-2 existed, and never rated
// since, should still eventually surface here instead of being invisible
// just because it predates the feature.
export async function getStaleProblems(userId: string) {
  const problems = await prisma.problem.findMany({
    where: { userId },
    select: {
      id: true,
      solvedAt: true,
      createdAt: true,
      progress: { select: { lastViewedAt: true, nextReviewAt: true } },
    },
  })

  const now = Date.now()
  return problems.filter((p) => {
    const nextReviewAt = p.progress?.nextReviewAt
    if (nextReviewAt) {
      return now >= new Date(nextReviewAt).getTime()
    }
    const lastSeen = p.progress?.lastViewedAt ?? p.solvedAt ?? p.createdAt
    return now - new Date(lastSeen).getTime() > STALE_AFTER_MS
  })
}

// Keeps a "Needs Revision" AUTO folder's membership matched to whatever is
// currently stale. There's no scheduled-job infra in this app, so instead of
// a cron recomputing this in the background, it's recomputed on every
// dashboard load — self-healing, no staleness risk, at the cost of a write
// happening on what's otherwise a page load. See DECISIONS.md.
//
// Cached in Redis for an hour (2026-07-13): this read+write was running on
// every single dashboard load for every user — the single heaviest thing
// this app does on a page that's otherwise just reads. A repeat dashboard
// visit within the cache window now skips Prisma entirely. Tradeoff:
// staleness can lag up to an hour behind reality (e.g. rating a problem via
// SM-2 won't drop it out of "Needs Revision" until the cache expires) —
// accepted the same way every other TTL-based cache in this app accepts it
// (see the AI hint cache in app/api/hint/rag/route.ts).
export async function syncNeedsRevisionFolder(userId: string) {
  const cacheKey = needsRevisionCacheKey(userId)
  const cached = await redis.get<{ count: number; folderId: string | null }>(cacheKey)
  if (cached) {
    return cached
  }

  const result = await computeNeedsRevisionFolder(userId)
  await redis.set(cacheKey, result, { ex: NEEDS_REVISION_CACHE_TTL_S })
  return result
}

async function computeNeedsRevisionFolder(userId: string) {
  const stale = await getStaleProblems(userId)

  const existing = await prisma.folder.findFirst({
    where: { userId, name: "Needs Revision", type: "AUTO" },
  })

  if (stale.length === 0) {
    // Nothing stale right now — clear old links but leave the folder itself
    // in place so it doesn't flicker in and out of existence.
    if (existing) {
      await prisma.folderProblem.deleteMany({ where: { folderId: existing.id } })
    }
    return { count: 0, folderId: existing?.id ?? null }
  }

  const folder = existing ??
    (await prisma.folder.create({
      data: { userId, name: "Needs Revision", type: "AUTO" },
    }))

  const staleIds = stale.map((p) => p.id)

  await prisma.folderProblem.createMany({
    data: staleIds.map((problemId) => ({ folderId: folder.id, problemId })),
    skipDuplicates: true,
  })

  // Drop links for problems that were stale before but aren't anymore
  // (e.g. the user just revisited one) so the folder doesn't accumulate
  // problems that no longer belong there.
  await prisma.folderProblem.deleteMany({
    where: { folderId: folder.id, problemId: { notIn: staleIds } },
  })

  return { count: stale.length, folderId: folder.id }
}

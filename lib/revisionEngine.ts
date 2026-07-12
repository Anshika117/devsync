import { prisma } from "@/lib/prisma"

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// A problem counts as "stale" if it hasn't been meaningfully touched in 30+
// days. "Touched" = lastViewedAt if we have one, otherwise falls back to
// solvedAt, otherwise createdAt — so a problem solved once and never
// revisited still eventually shows up here instead of being invisible
// forever just because ProblemProgress was never created for it.
export async function getStaleProblems(userId: string) {
  const problems = await prisma.problem.findMany({
    where: { userId },
    select: {
      id: true,
      solvedAt: true,
      createdAt: true,
      progress: { select: { lastViewedAt: true } },
    },
  })

  const now = Date.now()
  return problems.filter((p) => {
    const lastSeen = p.progress?.lastViewedAt ?? p.solvedAt ?? p.createdAt
    return now - new Date(lastSeen).getTime() > STALE_AFTER_MS
  })
}

// Keeps a "Needs Revision" AUTO folder's membership matched to whatever is
// currently stale. There's no scheduled-job infra in this app, so instead of
// a cron recomputing this in the background, it's recomputed on every
// dashboard load — self-healing, no staleness risk, at the cost of a write
// happening on what's otherwise a page load. See DECISIONS.md.
export async function syncNeedsRevisionFolder(userId: string) {
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

import { prisma } from "@/lib/prisma"
import { normalizeTag } from "@/lib/tagNormalizer"

export async function buildUserProfile(userId: string, topic: string | null = null) {
  const problems = await prisma.problem.findMany({
    where: { userId },
    select: { tags: true, difficulty: true, title: true, notes: true, progress: { select: { mistakeCount: true } } }
  })

  const tagStats: Record<string, { easy: number, medium: number, hard: number, total: number }> = {}

  // Tags are normalized before counting — Problem.tags stores whatever a
  // platform sent verbatim ("Dynamic Programming" from LeetCode vs "dp" from
  // Codeforces), and without this they'd silently count as two separate
  // topics here instead of one, skewing which tags look like "strengths" or
  // "weaknesses" for a user who solves on both platforms. See
  // lib/unifiedProfile.ts's getUnifiedTagBreakdown() for the same fix
  // applied to the dashboard's topic view.
  for (const problem of problems) {
    const seenOnThisProblem = new Set<string>()
    for (const rawTag of problem.tags) {
      const tag = normalizeTag(rawTag)
      if (seenOnThisProblem.has(tag)) continue
      seenOnThisProblem.add(tag)

      if (!tagStats[tag]) tagStats[tag] = { easy: 0, medium: 0, hard: 0, total: 0 }
      tagStats[tag].total++
      if (problem.difficulty === "Easy") tagStats[tag].easy++
      if (problem.difficulty === "Medium") tagStats[tag].medium++
      if (problem.difficulty === "Hard") tagStats[tag].hard++
    }
  }

  const sorted = Object.entries(tagStats).sort((a, b) => b[1].total - a[1].total)
  const strengths = sorted.slice(0, 5).map(([tag, s]) => `${tag} (${s.total} problems, ${s.hard} hard)`)
  const weaknesses = sorted.slice(-3).map(([tag, s]) => `${tag} (${s.total} problems only)`)

  const recentProblems = problems.slice(-5).map(p => p.title)
  const notedProblems = problems.filter(p => p.notes).map(p => `${p.title}: ${p.notes}`)

  // Branch-specific stats for whatever topic the current hint request is
  // about, computed from the same fetch rather than a second query. Lets the
  // prompt say "in this topic specifically" instead of only ever generic
  // app-wide strengths/weaknesses that may have nothing to do with what the
  // user is currently stuck on.
  const branch = topic ? problems.filter(p => p.tags.some(t => normalizeTag(t) === topic)) : []
  const branchProfile = branch.length > 0 ? {
    topic: topic!,
    solved: branch.length,
    hard: branch.filter(p => p.difficulty === "Hard").length,
    struggled: branch.filter(p => (p.progress?.mistakeCount ?? 0) > 0).length
  } : null

  return {
    totalSolved: problems.length,
    strengths,
    weaknesses,
    recentProblems,
    notedProblems: notedProblems.slice(0, 5),
    branchProfile
  }
}
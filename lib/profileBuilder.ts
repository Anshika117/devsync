import { prisma } from "@/lib/prisma"

export async function buildUserProfile(userId: string) {
  const problems = await prisma.problem.findMany({
    where: { userId },
    select: { tags: true, difficulty: true, title: true, notes: true }
  })

  const tagStats: Record<string, { easy: number, medium: number, hard: number, total: number }> = {}

  for (const problem of problems) {
    for (const tag of problem.tags) {
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

  return {
    totalSolved: problems.length,
    strengths,
    weaknesses,
    recentProblems,
    notedProblems: notedProblems.slice(0, 5)
  }
}
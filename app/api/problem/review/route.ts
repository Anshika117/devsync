import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { computeSM2 } from "@/lib/spacedRepetition"
import { parseBody, problemReviewSchema } from "@/lib/validation"

// Called when a user rates how well they recalled a problem (Again/Hard/
// Good/Easy in the UI, 0-5 internally). Runs SM-2 and persists the result
// on ProblemProgress — this is what nextReviewAt in revisionEngine.ts
// actually reads to decide what's due.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseBody(problemReviewSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { problemId, quality } = parsed.data
  const userId = session.user.id

  const problem = await prisma.problem.findFirst({ where: { id: problemId, userId } })
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  }

  const existing = await prisma.problemProgress.findUnique({ where: { problemId } })

  const result = computeSM2(
    {
      easeFactor: existing?.easeFactor ?? 2.5,
      intervalDays: existing?.intervalDays ?? 0,
      repetitionCount: existing?.revisionCount ?? 0,
    },
    quality
  )

  const now = new Date()
  // Normalized 0-1 snapshot of ease factor, purely for future display —
  // easeFactor itself ranges 1.3 upward with no fixed ceiling.
  const retentionScore = Math.min(1, Math.max(0, (result.easeFactor - 1.3) / 1.2))

  const sharedFields: Prisma.ProblemProgressUpdateInput = {
    lastViewedAt: now,
    lastRevisedAt: now,
    revisionCount: result.repetitionCount,
    easeFactor: result.easeFactor,
    intervalDays: result.intervalDays,
    nextReviewAt: result.nextReviewAt,
    retentionScore,
  }
  if (quality < 3) {
    sharedFields.mistakeCount = { increment: 1 }
  }

  const progress = await prisma.problemProgress.upsert({
    where: { problemId },
    update: sharedFields,
    create: {
      problemId,
      userId,
      firstSolvedAt: now,
      lastViewedAt: now,
      lastRevisedAt: now,
      revisionCount: result.repetitionCount,
      mistakeCount: quality < 3 ? 1 : 0,
      easeFactor: result.easeFactor,
      intervalDays: result.intervalDays,
      nextReviewAt: result.nextReviewAt,
      retentionScore,
    },
  })

  return NextResponse.json({
    intervalDays: result.intervalDays,
    nextReviewAt: progress.nextReviewAt,
  })
}

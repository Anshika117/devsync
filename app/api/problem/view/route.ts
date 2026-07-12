import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Called when a user clicks through to a problem's original platform link —
// the closest thing this app has to a genuine "I looked at this again"
// signal. Feeds ProblemProgress.lastViewedAt, which the revision engine uses
// to decide what's stale.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { problemId } = await req.json()
  const userId = session.user.id

  if (!problemId) return NextResponse.json({ error: "problemId required" }, { status: 400 })

  const problem = await prisma.problem.findFirst({ where: { id: problemId, userId } })
  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 })

  await prisma.problemProgress.upsert({
    where: { problemId },
    update: { lastViewedAt: new Date() },
    create: { problemId, userId, lastViewedAt: new Date(), firstSolvedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkCooldown } from "@/lib/rateLimit"
import { parseBody, problemDismissRevisionSchema } from "@/lib/validation"

// Same double-click guard shape as problem/move and notes/save — a cheap
// per-problem cooldown, not a per-user one, since dismissing a *different*
// problem right after should never be blocked.
const DISMISS_COOLDOWN_S = 2

// Called from the checkbox (or clicking the problem title) inside the
// Needs Revision / Revision folder views specifically. Deliberately does
// NOT run SM-2 (lib/spacedRepetition.ts) — that's the Again/Hard/Good/Easy
// popover's job, for when a user wants a real graded review. This is the
// simpler "I looked at it, stop bothering me about it" action: no quality
// rating, just clears the current staleness.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const parsed = parseBody(problemDismissRevisionSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { problemId, folderId } = parsed.data

  const [problem, folder] = await Promise.all([
    prisma.problem.findFirst({ where: { id: problemId, userId } }),
    prisma.folder.findFirst({ where: { id: folderId, userId } }),
  ])
  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

  const allowed = await checkCooldown("problem:dismiss-revision", problemId, DISMISS_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "This problem was just updated — please wait a moment." },
      { status: 429 }
    )
  }

  const isNeedsRevision = folder.name === "Needs Revision" && folder.type === "AUTO"
  const isRevisionStar = folder.name === "Revision" && folder.type === "CUSTOM"

  if (!isNeedsRevision && !isRevisionStar) {
    return NextResponse.json(
      { error: "This action only applies to the Revision or Needs Revision folders" },
      { status: 400 }
    )
  }

  if (isNeedsRevision) {
    // Clear the SM-2 due date (if any) and reset the flat-heuristic fallback
    // clock (lastViewedAt) to now — see lib/revisionEngine.ts's
    // getStaleProblems(): with nextReviewAt null, staleness falls back to
    // "30+ days since lastViewedAt", which just restarted. Deliberately
    // leaves easeFactor/intervalDays/revisionCount untouched — this isn't a
    // graded review, so it shouldn't affect real SM-2 progress if the user
    // has been using that system too.
    await prisma.problemProgress.upsert({
      where: { problemId },
      update: { nextReviewAt: null, lastViewedAt: new Date() },
      create: { problemId, userId, lastViewedAt: new Date(), firstSolvedAt: new Date() },
    })
  }

  // Both cases end the same way: remove the link to *this specific* folder.
  // Deleted directly (not left to Needs Revision's hourly cache recompute —
  // see lib/revisionEngine.ts's DECISIONS.md entry) so the problem
  // disappears from the list now, not up to an hour from now.
  await prisma.folderProblem.deleteMany({ where: { folderId, problemId } })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkCooldown } from "@/lib/rateLimit"
import { parseBody, notesSaveSchema } from "@/lib/validation"

// Scoped per-problem: the UI only calls this from an explicit "Save" button
// click (not a while-typing autosave), so this is purely a double-click/
// double-submit guard, not a throttle on legitimate note-taking — saving
// notes on a different problem right after is never affected.
const NOTES_SAVE_COOLDOWN_S = 2

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseBody(notesSaveSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { problemId, notes } = parsed.data
  const userId = session.user.id

  const allowed = await checkCooldown("notes:save", problemId, NOTES_SAVE_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "Notes were just saved — please wait a moment." },
      { status: 429 }
    )
  }

  // updateMany (not update) so the userId is enforced in the WHERE clause —
  // update() only takes a unique identifier and would let any authenticated
  // user overwrite notes on a problem they don't own just by knowing its id.
  const result = await prisma.problem.updateMany({
    where: { id: problemId, userId },
    data: { notes }
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkCooldown } from "@/lib/rateLimit"
import { parseBody, problemMoveSchema } from "@/lib/validation"

// Scoped to the problem being moved, not the user — a user moving several
// different problems in quick succession (e.g. cleaning up a folder) is
// completely normal and shouldn't be throttled. This only stops the exact
// same problem from being moved twice within the same couple of seconds,
// which is the double-click / accidental-double-drop case, not real usage.
const MOVE_COOLDOWN_S = 2

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(problemMoveSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { problemId, fromFolderId, toFolderId } = parsed.data
  const userId = session.user.id

  // Ownership checks — without these, a user could pass any problemId/fromFolderId
  // belonging to another user and either link a stranger's problem into their own
  // folder, or delete a FolderProblem row out of a folder they don't own.
  const [problem, toFolder] = await Promise.all([
    prisma.problem.findFirst({ where: { id: problemId, userId } }),
    prisma.folder.findFirst({ where: { id: toFolderId, userId } }),
  ])

  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  if (!toFolder) return NextResponse.json({ error: "Target folder not found" }, { status: 404 })

  const allowed = await checkCooldown("problem:move", problemId, MOVE_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "This problem was just moved — please wait a moment." },
      { status: 429 }
    )
  }

  if (fromFolderId) {
    const fromFolder = await prisma.folder.findFirst({ where: { id: fromFolderId, userId } })
    if (!fromFolder) return NextResponse.json({ error: "Source folder not found" }, { status: 404 })
  }

  await prisma.folderProblem.upsert({
    where: { folderId_problemId: { folderId: toFolderId, problemId } },
    update: {},
    create: { folderId: toFolderId, problemId },
  })

  if (fromFolderId) {
    await prisma.folderProblem.deleteMany({
      where: { folderId: fromFolderId, problemId },
    })
  }

  return NextResponse.json({ success: true })
}

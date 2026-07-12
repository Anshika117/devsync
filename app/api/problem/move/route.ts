import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { problemId, fromFolderId, toFolderId } = await req.json()
  const userId = session.user.id

  if (!problemId || !toFolderId) {
    return NextResponse.json({ error: "problemId and toFolderId required" }, { status: 400 })
  }

  // Ownership checks — without these, a user could pass any problemId/fromFolderId
  // belonging to another user and either link a stranger's problem into their own
  // folder, or delete a FolderProblem row out of a folder they don't own.
  const [problem, toFolder] = await Promise.all([
    prisma.problem.findFirst({ where: { id: problemId, userId } }),
    prisma.folder.findFirst({ where: { id: toFolderId, userId } }),
  ])

  if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  if (!toFolder) return NextResponse.json({ error: "Target folder not found" }, { status: 404 })

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

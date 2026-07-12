import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { folderId, action, targetFolderId } = await req.json()
  const userId = session.user.id

  if (!folderId) return NextResponse.json({ error: "Folder ID required" }, { status: 400 })

  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "move_problems") {
    if (!targetFolderId || targetFolderId === folderId) {
      return NextResponse.json(
        { error: "A different target folder is required to move problems" },
        { status: 400 }
      )
    }
    const targetFolder = await prisma.folder.findFirst({ where: { id: targetFolderId, userId } })
    if (!targetFolder) return NextResponse.json({ error: "Target folder not found" }, { status: 404 })

    const links = await prisma.folderProblem.findMany({
      where: { folderId },
      select: { problemId: true },
    })

    if (links.length > 0) {
      await prisma.folderProblem.createMany({
        data: links.map((l) => ({ folderId: targetFolderId, problemId: l.problemId })),
        skipDuplicates: true, // problem may already live in the target folder too
      })
    }
  } else {
    // "delete_problems" (default): remove problems that live *only* in this
    // folder. A problem that's also in another folder (e.g. an AUTO topic
    // folder) survives and just loses its link to this one.
    const links = await prisma.folderProblem.findMany({
      where: { folderId },
      select: { problemId: true },
    })
    const problemIds = links.map((l) => l.problemId)

    if (problemIds.length > 0) {
      const counts = await prisma.folderProblem.groupBy({
        by: ["problemId"],
        where: { problemId: { in: problemIds } },
        _count: { folderId: true },
      })
      const soloProblemIds = counts
        .filter((c) => c._count.folderId === 1)
        .map((c) => c.problemId)

      if (soloProblemIds.length > 0) {
        await prisma.problem.deleteMany({ where: { id: { in: soloProblemIds }, userId } })
      }
    }
  }

  // Remaining FolderProblem rows for this folder cascade-delete automatically.
  await prisma.folder.delete({ where: { id: folderId } })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { problemId } = await req.json()
  const userId = session.user.id

  // Find or create Revision folder
  const revisionFolder = await prisma.folder.upsert({
    where: {
      userId_name_type: { userId, name: "Revision", type: "CUSTOM" }
    },
    update: {},
    create: { name: "Revision", type: "CUSTOM", userId }
  })

  // Check if already in revision
  const existing = await prisma.folderProblem.findFirst({
    where: { folderId: revisionFolder.id, problemId }
  })

  if (existing) {
    await prisma.folderProblem.delete({ where: { id: existing.id } })
    return NextResponse.json({ starred: false })
  } else {
    await prisma.folderProblem.create({
      data: { folderId: revisionFolder.id, problemId }
    })
    return NextResponse.json({ starred: true })
  }
}
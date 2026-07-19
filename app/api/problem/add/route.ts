import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { invalidateDashboardStats } from "@/lib/dashboardStats"
import { parseBody, problemAddSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const parsed = parseBody(problemAddSchema, await req.json())
    if ("error" in parsed) return parsed.error
    const { folderId, title, url, platform, difficulty } = parsed.data
    const tags = parsed.data.tags.map((tag) => tag.trim()).filter(Boolean)

    const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    const problem = await prisma.problem.upsert({
      where: { userId_url: { userId, url } },
      update: { title, platform, difficulty, tags },
      create: { title, url, platform, difficulty, tags, userId, solvedAt: new Date() },
    })

    await prisma.folderProblem.upsert({
      where: { folderId_problemId: { folderId, problemId: problem.id } },
      update: {},
      create: { folderId, problemId: problem.id },
    })

    // A manually-added problem changes problemCount/difficultyCounts just
    // like a sync would — drop the cached dashboard stats (see
    // lib/dashboardStats.ts) so they're not shown stale.
    await invalidateDashboardStats(userId)

    return NextResponse.json({ success: true, problem })
  } catch (error: unknown) {
    console.error("Add problem error:", error)
    const details = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to add problem", details }, { status: 500 })
  }
}

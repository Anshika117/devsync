import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Platform, Difficulty } from "@prisma/client"

const VALID_PLATFORMS: Platform[] = ["LeetCode", "Codeforces", "CodeChef", "Other"]
const VALID_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard", "Unknown"]

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const body = await req.json()

    const folderId = body.folderId
    const title = body.title?.trim()
    const url = body.url?.trim()
    const platformInput = body.platform?.trim() || "Other"
    const difficultyInput = body.difficulty?.trim() || "Medium"

    const tags: string[] = Array.isArray(body.tags)
      ? body.tags.map((tag: string) => tag.trim()).filter(Boolean)
      : []

    if (!folderId) {
      return NextResponse.json(
        { error: "Folder ID required" },
        { status: 400 }
      )
    }

    if (!title || !url) {
      return NextResponse.json(
        { error: "Title and URL required" },
        { status: 400 }
      )
    }

    // Reject bad enum values here with a 400 instead of letting an invalid
    // string hit Postgres and blow up as an unhandled 500.
    if (!VALID_PLATFORMS.includes(platformInput as Platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
        { status: 400 }
      )
    }
    if (!VALID_DIFFICULTIES.includes(difficultyInput as Difficulty)) {
      return NextResponse.json(
        { error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}` },
        { status: 400 }
      )
    }
    const platform = platformInput as Platform
    const difficulty = difficultyInput as Difficulty

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    })

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      )
    }

    const problem = await prisma.problem.upsert({
      where: {
        userId_url: {
          userId,
          url,
        },
      },
      update: {
        title,
        platform,
        difficulty,
        tags,
      },
      create: {
        title,
        url,
        platform,
        difficulty,
        tags,
        userId,
        solvedAt: new Date(),
      },
    })

    await prisma.folderProblem.upsert({
      where: {
        folderId_problemId: {
          folderId,
          problemId: problem.id,
        },
      },
      update: {},
      create: {
        folderId,
        problemId: problem.id,
      },
    })

    return NextResponse.json({
      success: true,
      problem,
    })
  } catch (error: any) {
    console.error("Add problem error:", error)

    return NextResponse.json(
      {
        error: "Failed to add problem",
        details: error.message,
      },
      { status: 500 }
    )
  }
}

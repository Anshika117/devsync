import { auth } from "@/auth"
import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPrimaryTag } from "@/lib/tagNormalizer"
import type { Difficulty } from "@prisma/client"

function getRating(rating: number): Difficulty {
  if (rating < 1200) return "Easy"
  if (rating < 1800) return "Medium"
  return "Hard"
}

type CFSubmission = {
  verdict: string
  creationTimeSeconds: number
  problem: {
    contestId: number
    index: string
    name: string
    tags: string[]
    rating?: number
  }
}

type CFStatusResponse = {
  status: string
  result: CFSubmission[]
}

async function runCFSync(username: string, userId: string) {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`
  )
  const data = (await res.json()) as CFStatusResponse
  if (data.status !== "OK") return

  const accepted = data.result.filter((s) => s.verdict === "OK")
  const seen = new Set<string>()
  const unique = accepted.filter((s) => {
    const key = `${s.problem.contestId}-${s.problem.index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (const sub of unique) {
    const p = sub.problem
    const tags: string[] = p.tags ?? []
    const primaryTag = getPrimaryTag(tags.length > 0 ? tags : ["Uncategorized"])
    const difficulty = getRating(p.rating ?? 0)
    const url = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`

    const folder = await prisma.folder.upsert({
      where: { userId_name_type: { userId, name: primaryTag, type: "AUTO" } },
      update: {},
      create: { name: primaryTag, type: "AUTO", userId }
    })

    const problem = await prisma.problem.upsert({
      where: { userId_url: { userId, url } },
      update: { tags, difficulty },
      create: {
        title: p.name,
        platform: "Codeforces",
        difficulty,
        tags,
        url,
        userId,
        solvedAt: new Date(sub.creationTimeSeconds * 1000)
      }
    })

    await prisma.folderProblem.upsert({
      where: { folderId_problemId: { folderId: folder.id, problemId: problem.id } },
      update: {},
      create: { folderId: folder.id, problemId: problem.id }
    })
  }

  await prisma.activityLog.create({
    data: { userId, action: "CODEFORCES_SYNC", status: "SUCCESS" }
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { username } = await req.json()
  if (!username) {
    return NextResponse.json({ error: "CF handle required" }, { status: 400 })
  }

  const userId = session.user.id

  after(async () => {
    await runCFSync(username, userId)
  })

  return NextResponse.json({ 
    success: true, 
    message: "Sync started! Refresh dashboard in 30 seconds." 
  })
}
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPrimaryTag } from "@/lib/tagNormalizer"

function getRating(rating: number): string {
  if (rating < 1200) return "Easy"
  if (rating < 1800) return "Medium"
  return "Hard"
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

  try {
    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`
    )
    const data = await res.json()
    console.log(data)

    if (data.status !== "OK") {
      return NextResponse.json({ error: "Invalid CF handle" }, { status: 400 })
    }

    const accepted = data.result.filter(
      (s: any) => s.verdict === "OK"
    )

    // deduplicate by problem id
    const seen = new Set<string>()
    const unique = accepted.filter((s: any) => {
      const key = `${s.problem.contestId}-${s.problem.index}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    for (const sub of unique) {
      console.log(sub.problem.contestId, sub.problem.index, sub.problem.name);
      const p = sub.problem
      const tags: string[] = p.tags ?? []
      const primaryTag = getPrimaryTag(tags.length > 0 ? tags : ["Uncategorized"])
      const difficulty = getRating(p.rating ?? 0)
      const url = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`

      const folder = await prisma.folder.upsert({
        where: {
          userId_name_type: { userId, name: primaryTag, type: "AUTO" }
        },
        update: {},
        create: { name: primaryTag, type: "AUTO", userId }
      })

      const problem = await prisma.problem.upsert({
        where: { url },
        update: { tags, difficulty },
        create: {
          title: `${p.name}`,
          platform: "Codeforces",
          difficulty,
          tags,
          url,
          userId,
          solvedAt: new Date(sub.creationTimeSeconds * 1000)
        }
      })

      await prisma.folderProblem.upsert({
        where: {
          folderId_problemId: { folderId: folder.id, problemId: problem.id }
        },
        update: {},
        create: { folderId: folder.id, problemId: problem.id }
      })
    }

    await prisma.activityLog.create({
      data: { userId, action: "CODEFORCES_SYNC", status: "SUCCESS" }
    })

    return NextResponse.json({ success: true, synced: unique.length })

  } catch (error) {
    console.error("CF sync error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
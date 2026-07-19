import { auth } from "@/auth"
import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPrimaryTag } from "@/lib/tagNormalizer"
import { findOrCreateFolder } from "@/lib/folderUpsert"
import { checkCooldown } from "@/lib/rateLimit"
import { invalidateDashboardStats } from "@/lib/dashboardStats"
import { mapWithConcurrency } from "@/lib/concurrency"
import * as Sentry from "@sentry/nextjs"
import type { Difficulty } from "@prisma/client"
import { parseBody, syncUsernameSchema } from "@/lib/validation"

// Same reasoning as the LeetCode route's cooldown — protects Codeforces's
// API and this app's own DB from repeated back-to-back sync attempts.
const SYNC_COOLDOWN_S = 5 * 60

// Same middle-ground as LeetCode's tag-fetch concurrency — enough in flight
// to meaningfully speed up a large first sync without opening so many DB
// connections at once that the pool (or Supabase's own connection limit)
// gets stressed.
const WRITE_CONCURRENCY = 8

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

// Wrapped in try/catch (previously wasn't — a real gap compared to the
// LeetCode route, found while wiring up Sentry): this whole function runs
// detached from the request/response cycle inside next/server's after(), so
// an unhandled throw here (Codeforces API down, a malformed response, a DB
// error) used to just vanish as a silent unhandled rejection with zero
// record anywhere — no ActivityLog row, no console output tied to the
// request, nothing. Now it fails the same visible way the LeetCode sync
// already did.
async function runCFSync(username: string, userId: string) {
  try {
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

    const withTag = unique.map((sub) => {
      const tags: string[] = sub.problem.tags ?? []
      return { sub, primaryTag: getPrimaryTag(tags.length > 0 ? tags : ["Uncategorized"]) }
    })

    // Ensure every distinct topic folder exists first, sequentially — there
    // are only a handful of distinct tags in a batch, never one per problem,
    // so this stays cheap. Doing it up front (rather than per-problem, inside
    // the concurrent step below) is what makes the concurrency below safe:
    // findOrCreateFolder's findFirst-then-create isn't atomic, so two writes
    // racing to create the same not-yet-existing folder at the same time
    // could otherwise create it twice.
    const distinctTags = Array.from(new Set(withTag.map((w) => w.primaryTag)))
    const folderByTag = new Map<string, Awaited<ReturnType<typeof findOrCreateFolder>>>()
    for (const tag of distinctTags) {
      folderByTag.set(tag, await findOrCreateFolder(userId, tag, "AUTO"))
    }

    // Every folder this batch needs already exists, and each write below is
    // keyed by a real unique constraint (userId+url, folderId+problemId) —
    // safe to run with bounded concurrency instead of one submission at a
    // time, which is what made a large first sync slow.
    await mapWithConcurrency(withTag, WRITE_CONCURRENCY, async ({ sub, primaryTag }) => {
      const p = sub.problem
      const tags: string[] = p.tags ?? []
      const difficulty = getRating(p.rating ?? 0)
      const url = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`
      const folder = folderByTag.get(primaryTag)!

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
    })

    await prisma.activityLog.create({
      data: { userId, action: "CODEFORCES_SYNC", status: "SUCCESS" }
    })

    // Same reasoning as the LeetCode route — drop the cached dashboard stats
    // now that this sync may have changed them.
    await invalidateDashboardStats(userId)
  } catch (error: unknown) {
    console.error("Codeforces sync error:", error)
    Sentry.captureException(error, { tags: { route: "sync/codeforces" }, extra: { userId } })
    const message = error instanceof Error ? error.message : "Unknown error"
    await prisma.activityLog.create({
      data: { userId, action: "CODEFORCES_SYNC", status: "FAILED", error: message }
    })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseBody(syncUsernameSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { username } = parsed.data

  const userId = session.user.id

  const allowed = await checkCooldown("sync:codeforces", userId, SYNC_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "You just synced Codeforces — please wait a few minutes and try again." },
      { status: 429 }
    )
  }

  after(async () => {
    await runCFSync(username, userId)
  })

  return NextResponse.json({ 
    success: true, 
    message: "Sync started! Refresh dashboard in 30 seconds." 
  })
}
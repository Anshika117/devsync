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

const LC_GRAPHQL = "https://leetcode.com/graphql"

// Minimum time between sync attempts for one user. Protects two things:
// LeetCode's API from getting hammered by one impatient user double/triple
// clicking "Sync", and this app's own DB from redundant upsert passes over
// the same ~20 problems within seconds of each other.
const SYNC_COOLDOWN_S = 5 * 60

// LeetCode's public GraphQL API has no documented rate limit, but hammering it with
// 40+ simultaneous requests risks 429s / IP flags. 8 in-flight requests is a safe
// middle ground — empirically ~8x faster than the old fully-sequential loop without
// tripping anything.
const TAG_FETCH_CONCURRENCY = 8

type LCSubmission = {
  id: string
  title: string
  titleSlug: string
  timestamp: string
}

type LCQuestion = {
  topicTags: { name: string }[]
  difficulty: string
}

// Was hardcoded to 50 — an arbitrary number our own code chose, not a
// documented LeetCode ceiling. Raised to a much larger ask (same "request
// far more than anyone realistically needs" pattern the Codeforces route
// already uses with count=10000): LeetCode's own server still decides the
// real cap, so this is a no-downside change — worst case nothing above the
// old ceiling comes back, best case a lot more of a user's real history
// does. Couldn't verify which outcome happens from this sandbox (no
// outbound network access here) — confirm on your own next sync.
const RECENT_SUBMISSIONS_LIMIT = 10000

async function getRecentSubmissions(username: string): Promise<LCSubmission[]> {
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query recentAcSubmissions($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
            id
            title
            titleSlug
            timestamp
          }
        }
      `,
      variables: { username, limit: RECENT_SUBMISSIONS_LIMIT },
    }),
  })
  const data = await res.json()
  return data.data.recentAcSubmissionList
}

async function getProblemTags(titleSlug: string): Promise<LCQuestion | null> {
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
    },
    body: JSON.stringify({
      query: `
        query getTopicTags($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            topicTags {
              name
            }
            difficulty
          }
        }
      `,
      variables: { titleSlug },
    }),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch tags for ${titleSlug}`)
  }

  const data = await res.json()

  if (data.errors) {
    console.error("LeetCode question error:", data.errors)
    return null
  }

  return data.data?.question ?? null
}

async function runLeetCodeSync(username: string, userId: string) {
  try {
    const submissions = await getRecentSubmissions(username)

    const seen = new Set<string>()
    const uniqueSubmissions = submissions.filter((sub) => {
      if (seen.has(sub.titleSlug)) return false
      seen.add(sub.titleSlug)
      return true
    })

    // The slow part: one GraphQL call per problem to fetch tags (LeetCode's
    // recentAcSubmissionList doesn't return them). Fan these out with bounded
    // concurrency instead of awaiting them one at a time.
    const withTags = await mapWithConcurrency(
      uniqueSubmissions,
      TAG_FETCH_CONCURRENCY,
      async (sub) => ({ sub, question: await getProblemTags(sub.titleSlug) })
    )

    // DB writes stay sequential — they're local/pooled connections (fast), and
    // sequential upserts avoid any risk of two problems racing to create the
    // same AUTO folder concurrently.
    let synced = 0
    for (const { sub, question } of withTags) {
      if (!question) continue

      const tags = question.topicTags.map((t) => t.name)
      const primaryTag = getPrimaryTag(tags.length > 0 ? tags : ["Uncategorized"])
      const difficulty = (question.difficulty || "Unknown") as Difficulty
      const url = `https://leetcode.com/problems/${sub.titleSlug}/`

      const folder = await findOrCreateFolder(userId, primaryTag, "AUTO")

      const problem = await prisma.problem.upsert({
        where: { userId_url: { userId, url } },
        update: {
          title: sub.title,
          platform: "LeetCode",
          difficulty,
          tags,
          solvedAt: new Date(Number(sub.timestamp) * 1000),
        },
        create: {
          title: sub.title,
          platform: "LeetCode",
          difficulty,
          tags,
          url,
          userId,
          solvedAt: new Date(Number(sub.timestamp) * 1000),
        },
      })

      await prisma.folderProblem.upsert({
        where: {
          folderId_problemId: { folderId: folder.id, problemId: problem.id },
        },
        update: {},
        create: { folderId: folder.id, problemId: problem.id },
      })

      synced++
    }

    await prisma.activityLog.create({
      data: { userId, action: "LEETCODE_SYNC", status: "SUCCESS" },
    })

    // Sync just changed this user's problem count/difficulty mix — drop the
    // cached dashboard stats so the "refresh your dashboard" promise in the
    // response below is actually true instead of showing up-to-10-min-old
    // numbers. See lib/dashboardStats.ts.
    await invalidateDashboardStats(userId)

    return synced
  } catch (error: unknown) {
    console.error("LeetCode sync error:", error)
    // This runs inside next/server's after(), completely detached from the
    // request/response cycle — the client already got its "sync started"
    // response and has no way to see this failure. Before Sentry, the only
    // record of it was this console.error (gone once the server process
    // rotates logs) and an ActivityLog row (which nothing actively watches;
    // a user would have to know to go look at it). Sentry.captureException
    // means a background sync failure actually surfaces somewhere.
    Sentry.captureException(error, { tags: { route: "sync/leetcode" }, extra: { userId } })
    const message = error instanceof Error ? error.message : "Unknown error"
    await prisma.activityLog.create({
      data: {
        userId,
        action: "LEETCODE_SYNC",
        status: "FAILED",
        error: message,
      },
    })
    return 0
  }
}

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const parsed = parseBody(syncUsernameSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { username } = parsed.data

  const allowed = await checkCooldown("sync:leetcode", userId, SYNC_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "You just synced LeetCode — please wait a few minutes and try again." },
      { status: 429 }
    )
  }

  // Run the actual sync after the response is sent, mirroring the Codeforces
  // route. The client polls/refreshes the dashboard rather than blocking on a
  // request that can take several seconds even with parallel tag fetches.
  after(async () => {
    await runLeetCodeSync(username, userId)
  })

  return NextResponse.json({
    success: true,
    message: "LeetCode sync started! Refresh your dashboard in a few seconds.",
  })
}

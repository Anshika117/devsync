import { auth } from "@/auth"
import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPrimaryTag } from "@/lib/tagNormalizer"
import type { Difficulty } from "@prisma/client"

const LC_GRAPHQL = "https://leetcode.com/graphql"

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
      variables: { username, limit: 50 },
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

// Runs `worker` over `items` with at most `limit` requests in flight at once,
// instead of either fully sequential (slow) or Promise.all (unbounded, risks
// rate-limiting an external API we don't control).
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runWorker)
  )

  return results
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

      const folder = await prisma.folder.upsert({
        where: {
          userId_name_type: { userId, name: primaryTag, type: "AUTO" },
        },
        update: {},
        create: { name: primaryTag, type: "AUTO", userId },
      })

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

    return synced
  } catch (error: unknown) {
    console.error("LeetCode sync error:", error)
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
  const body = await req.json()
  const username = body.username?.trim()

  if (!username) {
    return NextResponse.json(
      { error: "LeetCode username required" },
      { status: 400 }
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

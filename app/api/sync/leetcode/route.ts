import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPrimaryTag } from "@/lib/tagNormalizer"

const LC_GRAPHQL = "https://leetcode.com/graphql"

async function getRecentSubmissions(username: string) {
    const res = await fetch(LC_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query userSolvedProblems($username: String!) {
            allQuestionsCount { difficulty count }
            matchedUser(username: $username) {
              submitStatsGlobal {
                acSubmissionNum { difficulty count }
              }
              problemsSolvedBeatsStats { difficulty percentage }
            }
            recentAcSubmissionList(username: $username, limit: 50) {
              id
              title
              titleSlug
              timestamp
            }
          }
        `,
        variables: { username }
      })
    })
    const data = await res.json()
    return data.data.recentAcSubmissionList
  }

async function getProblemTags(titleSlug: string) {
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query getTopicTags($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            topicTags { name }
            difficulty
          }
        }
      `,
      variables: { titleSlug }
    })
  })
  const data = await res.json()
  return data.data.question
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const { username } = await req.json()

  if (!username) {
    return NextResponse.json({ error: "LeetCode username required" }, { status: 400 })
  }

  try {
    const submissions = await getRecentSubmissions(username)

    for (const sub of submissions) {
      const question = await getProblemTags(sub.titleSlug)
      if (!question) continue

      const tags = question.topicTags.map((t: any) => t.name)
      const primaryTag = getPrimaryTag(tags)
      const difficulty = question.difficulty

      // upsert AUTO folder
      const folder = await prisma.folder.upsert({
        where: {
          userId_name_type: {
            userId,
            name: primaryTag,
            type: "AUTO"
          }
        },
        update: {},
        create: { name: primaryTag, type: "AUTO", userId }
      })

      // upsert problem
      const problem = await prisma.problem.upsert({
        where: { url: `https://leetcode.com/problems/${sub.titleSlug}/` },
        update: { tags, difficulty },
        create: {
          title: sub.title,
          platform: "LeetCode",
          difficulty,
          tags,
          url: `https://leetcode.com/problems/${sub.titleSlug}/`,
          userId,
          solvedAt: new Date(parseInt(sub.timestamp) * 1000)
        }
      })

      // link problem to folder
      await prisma.folderProblem.upsert({
        where: {
          folderId_problemId: {
            folderId: folder.id,
            problemId: problem.id
          }
        },
        update: {},
        create: { folderId: folder.id, problemId: problem.id }
      })
    }
    await prisma.activityLog.create({
        data: {
          userId,
          action: "LEETCODE_SYNC",
          status: "SUCCESS"
        }
      })

    return NextResponse.json({ 
      success: true, 
      synced: submissions.length 
    })

  } catch (error) {
    console.error("Sync error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
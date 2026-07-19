import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { buildUserProfile } from "@/lib/profileBuilder"
import { prisma } from "@/lib/prisma"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { classifyTopicFromText, getFolderTier, normalizeTag } from "@/lib/tagNormalizer"
import { parseBody, hintRagSchema } from "@/lib/validation"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString()
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "given", "find", "return", "you", "of", "in", "to", "and", "or", "for", "with"])
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
}

async function findSimilarSolvedProblems(userId: string, problemStatement: string, tags: string[], topic: string | null) {
  const keywords = extractKeywords(problemStatement)

  const userProblems = await prisma.problem.findMany({
    where: { userId },
    select: { id: true, title: true, tags: true, notes: true, difficulty: true, url: true }
  })

  function score(p: (typeof userProblems)[number]): number {
    const titleWords = extractKeywords(p.title)
    const tagOverlap = p.tags.filter(t => tags.includes(t)).length
    const titleOverlap = titleWords.filter(w => keywords.includes(w)).length
    return tagOverlap * 3 + titleOverlap * 2 + (p.notes ? 1 : 0)
  }

  // Scope to the guessed topic branch first, widen one tier up if that's too
  // thin, then fall back to the full history — a wrong guess or a sparsely
  // practiced topic should never mean zero context, just less-targeted context.
  const tier = topic ? getFolderTier(topic) : null
  const branch = topic ? userProblems.filter(p => p.tags.some(t => normalizeTag(t) === topic)) : []
  const tierPool = tier ? userProblems.filter(p => p.tags.some(t => getFolderTier(normalizeTag(t)) === tier)) : []
  const pool = branch.length >= 2 ? branch : tierPool.length >= 2 ? tierPool : userProblems

  return pool
    .map(p => ({ ...p, score: score(p) }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsedBody = parseBody(hintRagSchema, await req.json())
  if ("error" in parsedBody) return parsedBody.error
  const { problemStatement, problemTitle, tags } = parsedBody.data

  const userId = session.user.id
  const problemHash = hashString(problemStatement)
  const cacheKey = `rag_hint:${userId}:${problemHash}`
  const rateLimitKey = `hint_count:${userId}:${new Date().toISOString().split("T")[0]}`

  // Step 1: Redis cache check
  const cached = await redis.get(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached as object, source: "cache" })
  }

  // Step 2: Rate limit
  const count = await redis.get(rateLimitKey) as number | null
  if (count && count >= 10) {
    return NextResponse.json({ error: "Daily limit of 10 hints reached." }, { status: 429 })
  }

  // Step 3: Find similar solved problems, scoped to the problem's topic branch
  const topic = classifyTopicFromText(problemStatement)
  const similarProblems = await findSimilarSolvedProblems(userId, problemStatement, tags, topic)

  // Step 4: Build user profile, including branch-specific stats for the classified topic
  const profile = await buildUserProfile(userId, topic)

  // Step 5: Build RAG-enhanced prompt
  const similarContext = similarProblems.length > 0
    ? `SIMILAR PROBLEMS USER HAS SOLVED:
${similarProblems.map(p => `- "${p.title}" (${p.difficulty}) [${p.tags.join(", ")}]${p.notes ? ` — User's note: "${p.notes}"` : ""}`).join("\n")}

If this problem uses a similar approach to any above, explicitly reference it in your hints.`
    : "User has not solved similar problems before."

  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

  const prompt = `You are an expert DSA mentor helping a FAANG interview candidate.

USER PROFILE:
- Total problems solved: ${profile.totalSolved}
- Strong topics: ${profile.strengths.join(", ")}
- Weak topics: ${profile.weaknesses.join(", ")}
- Recently solved: ${profile.recentProblems.join(", ")}
${profile.branchProfile ? `- In ${profile.branchProfile.topic} specifically: ${profile.branchProfile.solved} solved (${profile.branchProfile.hard} hard), struggled on ${profile.branchProfile.struggled} of them` : ""}

${similarContext}

CURRENT PROBLEM:
Title: ${problemTitle || "Unknown"}
Tags: ${tags.join(", ") || "Unknown"}
Statement: ${problemStatement}

INSTRUCTIONS:
- If similar problems found above, START your hints by referencing the approach from that problem
- Personalize based on user's weak/strong topics
- Give exactly 3 progressive hints

Respond ONLY with valid JSON:
{
  "context": "What concept/pattern this problem tests (2-3 sentences)",
  "similarFound": "Name of similar problem user solved, or empty string if none",
  "similarApproach": "How the similar problem's approach applies here, or empty string",
  "hints": [
    "Hint 1: Conceptual nudge only",
    "Hint 2: More specific with analogy to their known problems",
    "Hint 3: Near-complete walkthrough"
  ]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  let parsed
  try {
    const clean = text.replace(/```json|```/g, "").trim()
    parsed = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: "AI response parsing failed" }, { status: 500 })
  }

  // Surface the classified topic to the frontend too — lets the UI show
  // *why* a hint looks the way it does (which branch retrieval was scoped
  // to) instead of that step staying invisible. Stored in the cached
  // payload itself so a cache hit returns the same topic, not just the
  // freshly-generated path.
  const responseBody = { ...parsed, topic }

  await redis.set(cacheKey, responseBody, { ex: 86400 })
  await redis.incr(rateLimitKey)
  await redis.expire(rateLimitKey, 86400)

  return NextResponse.json({ ...responseBody, source: "gemini" })
}
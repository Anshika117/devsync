import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { buildUserProfile } from "@/lib/profileBuilder"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString()
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { problemStatement } = await req.json()
  if (!problemStatement?.trim()) {
    return NextResponse.json({ error: "Problem statement required" }, { status: 400 })
  }

  const userId = session.user.id
  const problemHash = hashString(problemStatement.trim())
  const cacheKey = `hint:${problemHash}`
  const rateLimitKey = `hint_count:${userId}:${new Date().toISOString().split("T")[0]}`

  // Step 1: Check Redis cache
  const cached = await redis.get(cacheKey)
  console.log("Cache key:", cacheKey, "Cache hit:", !!cached) // ADD THIS
  if (cached) {
    return NextResponse.json({ ...cached as object, source: "cache" })
  }

  // Step 2: Check rate limit
  const count = await redis.get(rateLimitKey) as number | null
  if (count && count >= 10) {
    return NextResponse.json({ error: "Daily limit of 10 hints reached. Come back tomorrow." }, { status: 429 })
  }

  // Step 3: Build user profile
  const profile = await buildUserProfile(userId)

  // Step 4: Call Gemini
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

  const prompt = `You are an expert DSA mentor helping a competitive programmer prepare for FAANG interviews.

USER PROFILE:
- Total problems solved: ${profile.totalSolved}
- Strong topics: ${profile.strengths.join(", ")}
- Weak topics: ${profile.weaknesses.join(", ")}
- Recently solved: ${profile.recentProblems.join(", ")}
${profile.notedProblems.length > 0 ? `- Their own notes on past problems: ${profile.notedProblems.join(" | ")}` : ""}

PROBLEM STATEMENT:
${problemStatement}

Based on this user's profile, give them personalized help. If they are weak at the topic this problem covers, start from basics. If they are strong, give a more advanced hint.

Respond with ONLY valid JSON in this exact format:
{
  "context": "Brief explanation of what concept/pattern this problem tests (2-3 sentences)",
  "hints": [
    "Hint 1: Conceptual nudge only, no code, just the right way to think about it",
    "Hint 2: More specific approach with an example or analogy to their known topics",  
    "Hint 3: Near-complete walkthrough of the algorithm without actual code"
  ],
  "similarToSolved": "If this is similar to any problem in their history, mention it here. Otherwise empty string."
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

  // Step 5: Cache result + increment rate limit
  await redis.set(cacheKey, parsed, { ex: 86400 }) // 24hr TTL
  await redis.incr(rateLimitKey)
  await redis.expire(rateLimitKey, 86400)

  return NextResponse.json({ ...parsed, source: "gemini" })
}
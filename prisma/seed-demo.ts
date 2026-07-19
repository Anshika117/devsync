/**
 * One-off script to populate an EXISTING account with realistic-looking
 * data, purely so the live demo link doesn't show an empty dashboard when
 * someone clicks it from a LinkedIn post / resume.
 *
 * This does NOT create a user — sign in once via Google (or register) on
 * the live site first, so a real User row exists, then run this against
 * that account's email. Safe to re-run: everything is keyed on the same
 * unique constraints the app itself uses (folder name+type, problem
 * userId+url, one ProblemProgress per problem, one DailyGoal per day),
 * so re-running just updates the same rows instead of duplicating them.
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts your-demo-account@email.com
 *
 * (If `tsx` isn't installed: `npm install -D tsx` first.)
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// --- Curated, realistic-looking problem pool, grouped by topic -----------
// Titles are real, well-known problem names. URLs point at the real
// LeetCode/Codeforces problem pages so clicking through from a folder card
// doesn't 404 during a demo.
type SeedProblem = {
  title: string
  platform: "LeetCode" | "Codeforces"
  difficulty: "Easy" | "Medium" | "Hard"
  tags: string[]
  slug: string // leetcode titleSlug or codeforces contest/index
}

const TOPICS: Record<string, SeedProblem[]> = {
  Array: [
    { title: "Two Sum", platform: "LeetCode", difficulty: "Easy", tags: ["Array", "Hash Table"], slug: "two-sum" },
    { title: "Best Time to Buy and Sell Stock", platform: "LeetCode", difficulty: "Easy", tags: ["Array", "Dynamic Programming"], slug: "best-time-to-buy-and-sell-stock" },
    { title: "Product of Array Except Self", platform: "LeetCode", difficulty: "Medium", tags: ["Array", "Prefix Sum"], slug: "product-of-array-except-self" },
    { title: "Maximum Subarray", platform: "LeetCode", difficulty: "Medium", tags: ["Array", "Dynamic Programming"], slug: "maximum-subarray" },
    { title: "3Sum", platform: "LeetCode", difficulty: "Medium", tags: ["Array", "Two Pointers"], slug: "3sum" },
  ],
  "Hash Table": [
    { title: "Group Anagrams", platform: "LeetCode", difficulty: "Medium", tags: ["Hash Table", "String"], slug: "group-anagrams" },
    { title: "Longest Consecutive Sequence", platform: "LeetCode", difficulty: "Medium", tags: ["Hash Table", "Array"], slug: "longest-consecutive-sequence" },
    { title: "Subarray Sum Equals K", platform: "LeetCode", difficulty: "Medium", tags: ["Hash Table", "Array", "Prefix Sum"], slug: "subarray-sum-equals-k" },
  ],
  "Dynamic Programming": [
    { title: "Climbing Stairs", platform: "LeetCode", difficulty: "Easy", tags: ["Dynamic Programming"], slug: "climbing-stairs" },
    { title: "House Robber", platform: "LeetCode", difficulty: "Medium", tags: ["Dynamic Programming"], slug: "house-robber" },
    { title: "Longest Increasing Subsequence", platform: "LeetCode", difficulty: "Medium", tags: ["Dynamic Programming", "Binary Search"], slug: "longest-increasing-subsequence" },
    { title: "Coin Change", platform: "LeetCode", difficulty: "Medium", tags: ["Dynamic Programming"], slug: "coin-change" },
    { title: "Edit Distance", platform: "LeetCode", difficulty: "Hard", tags: ["Dynamic Programming", "String"], slug: "edit-distance" },
    { title: "Longest Common Subsequence", platform: "LeetCode", difficulty: "Medium", tags: ["Dynamic Programming", "String"], slug: "longest-common-subsequence" },
  ],
  Graph: [
    { title: "Number of Islands", platform: "LeetCode", difficulty: "Medium", tags: ["Graph", "DFS", "BFS"], slug: "number-of-islands" },
    { title: "Course Schedule", platform: "LeetCode", difficulty: "Medium", tags: ["Graph", "Topological Sort"], slug: "course-schedule" },
    { title: "Clone Graph", platform: "LeetCode", difficulty: "Medium", tags: ["Graph", "DFS", "BFS"], slug: "clone-graph" },
    { title: "Network Delay Time", platform: "LeetCode", difficulty: "Medium", tags: ["Graph", "Shortest Path"], slug: "network-delay-time" },
  ],
  Tree: [
    { title: "Binary Tree Inorder Traversal", platform: "LeetCode", difficulty: "Easy", tags: ["Tree", "DFS"], slug: "binary-tree-inorder-traversal" },
    { title: "Validate Binary Search Tree", platform: "LeetCode", difficulty: "Medium", tags: ["Tree", "DFS"], slug: "validate-binary-search-tree" },
    { title: "Lowest Common Ancestor of a Binary Tree", platform: "LeetCode", difficulty: "Medium", tags: ["Tree", "DFS"], slug: "lowest-common-ancestor-of-a-binary-tree" },
    { title: "Binary Tree Level Order Traversal", platform: "LeetCode", difficulty: "Medium", tags: ["Tree", "BFS"], slug: "binary-tree-level-order-traversal" },
  ],
  "Binary Search": [
    { title: "Binary Search", platform: "LeetCode", difficulty: "Easy", tags: ["Binary Search"], slug: "binary-search" },
    { title: "Search in Rotated Sorted Array", platform: "LeetCode", difficulty: "Medium", tags: ["Binary Search", "Array"], slug: "search-in-rotated-sorted-array" },
    { title: "Median of Two Sorted Arrays", platform: "LeetCode", difficulty: "Hard", tags: ["Binary Search", "Array"], slug: "median-of-two-sorted-arrays" },
  ],
  "Two Pointers": [
    { title: "Container With Most Water", platform: "LeetCode", difficulty: "Medium", tags: ["Two Pointers", "Array"], slug: "container-with-most-water" },
    { title: "Trapping Rain Water", platform: "LeetCode", difficulty: "Hard", tags: ["Two Pointers", "Array"], slug: "trapping-rain-water" },
    { title: "Valid Palindrome", platform: "LeetCode", difficulty: "Easy", tags: ["Two Pointers", "String"], slug: "valid-palindrome" },
  ],
  Greedy: [
    { title: "Jump Game", platform: "LeetCode", difficulty: "Medium", tags: ["Greedy", "Array"], slug: "jump-game" },
    { title: "Gas Station", platform: "LeetCode", difficulty: "Medium", tags: ["Greedy", "Array"], slug: "gas-station" },
  ],
  Codeforces: [
    { title: "Watermelon", platform: "Codeforces", difficulty: "Easy", tags: ["math", "brute force"], slug: "4/A" },
    { title: "Way Too Long Words", platform: "Codeforces", difficulty: "Easy", tags: ["strings"], slug: "71/A" },
    { title: "Theatre Square", platform: "Codeforces", difficulty: "Medium", tags: ["math"], slug: "1/A" },
    { title: "Chat room", platform: "Codeforces", difficulty: "Easy", tags: ["greedy", "strings"], slug: "58/A" },
    { title: "Petya and Strings", platform: "Codeforces", difficulty: "Easy", tags: ["strings"], slug: "112/A" },
  ],
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function platformUrl(p: SeedProblem): string {
  if (p.platform === "LeetCode") return `https://leetcode.com/problems/${p.slug}/`
  return `https://codeforces.com/problemset/problem/${p.slug}` // slug is "contestId/index", e.g. "4/A"
}

async function main() {
  const email = process.argv[2] || process.env.DEMO_USER_EMAIL
  if (!email) {
    console.error("Usage: npx tsx prisma/seed-demo.ts <account-email>")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No user found with email "${email}". Sign in on the live site once first (Google or register), then re-run this.`)
    process.exit(1)
  }
  console.log(`Seeding demo data for ${user.email} (${user.id})...`)

  let problemIndex = 0
  let totalProblems = 0
  let totalWithProgress = 0

  for (const [topic, problems] of Object.entries(TOPICS)) {
    // Codeforces problems don't get their own folder — they land in whatever
    // topic folder their tags map to in real usage. For seeding simplicity,
    // give them their own folder too, since it still demonstrates
    // multi-platform sync visually on the dashboard.
    const folder = await prisma.folder.upsert({
      where: { userId_name_type: { userId: user.id, name: topic, type: "AUTO" } },
      update: {},
      create: { userId: user.id, name: topic, type: "AUTO" },
    })

    for (const p of problems) {
      problemIndex++
      const solvedAt = daysAgo(3 + problemIndex * 2 + Math.floor(Math.random() * 5))

      const problem = await prisma.problem.upsert({
        where: { userId_url: { userId: user.id, url: platformUrl(p) } },
        update: { title: p.title, platform: p.platform, difficulty: p.difficulty, tags: p.tags, solvedAt },
        create: {
          userId: user.id,
          title: p.title,
          platform: p.platform,
          difficulty: p.difficulty,
          tags: p.tags,
          url: platformUrl(p),
          solvedAt,
        },
      })
      totalProblems++

      await prisma.folderProblem.upsert({
        where: { folderId_problemId: { folderId: folder.id, problemId: problem.id } },
        update: {},
        create: { folderId: folder.id, problemId: problem.id },
      })

      // Give roughly 2 out of every 3 problems SM-2 progress state, so the
      // Needs Revision folder and the profile's retention stats aren't
      // empty either. Stagger nextReviewAt so some are overdue (shows up in
      // Needs Revision right away) and some are scheduled for later.
      if (problemIndex % 3 !== 0) {
        const overdue = problemIndex % 2 === 0
        await prisma.problemProgress.upsert({
          where: { problemId: problem.id },
          update: {},
          create: {
            problemId: problem.id,
            userId: user.id,
            firstSolvedAt: solvedAt,
            lastViewedAt: solvedAt,
            lastRevisedAt: solvedAt,
            revisionCount: Math.floor(Math.random() * 3),
            mistakeCount: Math.floor(Math.random() * 2),
            retentionScore: Math.round(Math.random() * 100) / 100,
            easeFactor: 2.1 + Math.random() * 0.8,
            intervalDays: overdue ? 3 : 14,
            // daysAgo(2) = 2 days in the past (overdue, shows in Needs Revision
            // immediately); daysAgo(-10) = 10 days in the future (not due yet).
            nextReviewAt: overdue ? daysAgo(2) : daysAgo(-10),
          },
        })
        totalWithProgress++
      }
    }
  }

  // A CUSTOM folder the "user" made themselves — shows the dashboard isn't
  // 100% auto-generated, and that custom organization coexists with synced
  // folders untouched.
  await prisma.folder.upsert({
    where: { userId_name_type: { userId: user.id, name: "FAANG Prep", type: "CUSTOM" } },
    update: {},
    create: { userId: user.id, name: "FAANG Prep", type: "CUSTOM" },
  })

  // Recurring goal + a ~10-day history so the streak badge shows something
  // real instead of "0 day streak" the moment someone opens /goals. Using a
  // fixed, deterministic id (instead of letting Prisma default to a cuid)
  // is what makes this upsert-safe to re-run — same row every time.
  const recurring = await prisma.recurringGoal.upsert({
    where: { id: `${user.id}-demo-recurring` },
    update: {},
    create: { id: `${user.id}-demo-recurring`, userId: user.id, title: "Solve 2 problems", active: true },
  })

  for (let i = 9; i >= 0; i--) {
    const targetDate = daysAgo(i)
    targetDate.setHours(0, 0, 0, 0)
    const done = i !== 0 // every past day done, today left open — realistic, not suspiciously perfect
    await prisma.dailyGoal.upsert({
      where: { recurringGoalId_targetDate: { recurringGoalId: recurring.id, targetDate } },
      update: { done },
      create: {
        userId: user.id,
        recurringGoalId: recurring.id,
        title: recurring.title,
        targetDate,
        done,
        completedAt: done ? targetDate : null,
      },
    })
  }

  // A few realistic ActivityLog rows so the sync history isn't empty either.
  await prisma.activityLog.createMany({
    data: [
      { userId: user.id, action: "LEETCODE_SYNC", status: "SUCCESS" },
      { userId: user.id, action: "CODEFORCES_SYNC", status: "SUCCESS" },
    ],
  })

  console.log(`Done. ${totalProblems} problems across ${Object.keys(TOPICS).length} topic folders, ${totalWithProgress} with revision progress, 10-day goal streak seeded.`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})

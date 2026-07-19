import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import UnifiedProgressView from "@/components/UnifiedProgressView"
import {
  getUnifiedTagBreakdown,
  getLeetCodeActualTotals,
  getLeetCodeContestRating,
  getCodeforcesRating,
} from "@/lib/unifiedProfile"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, lcUsername: true, cfHandle: true }
  })

  const [
    tagBreakdown,
    leetcodeSyncedCount,
    codeforcesSyncedCount,
    leetcodeActual,
    leetcodeContestRating,
    codeforcesRating,
  ] = await Promise.all([
    getUnifiedTagBreakdown(userId),
    prisma.problem.count({ where: { userId, platform: "LeetCode" } }),
    prisma.problem.count({ where: { userId, platform: "Codeforces" } }),
    // Real platform-wide totals, independent of the sync cap — only worth
    // fetching if there's a username to fetch them for.
    user?.lcUsername ? getLeetCodeActualTotals(user.lcUsername) : Promise.resolve(null),
    user?.lcUsername ? getLeetCodeContestRating(user.lcUsername) : Promise.resolve(null),
    user?.cfHandle ? getCodeforcesRating(user.cfHandle) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        <Link
          href="/settings"
          className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"
        >
          Settings →
        </Link>
      </div>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 mb-10">
        {user?.image && (
          <img src={user.image} alt="avatar" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <p className="text-xl font-semibold">{user?.name}</p>
          <p className="text-gray-400">{user?.email}</p>
        </div>
      </div>

      <div className="mb-6">
        <UnifiedProgressView
          leetcodeSyncedCount={leetcodeSyncedCount}
          codeforcesSyncedCount={codeforcesSyncedCount}
          leetcodeActual={leetcodeActual}
          tagBreakdown={tagBreakdown}
          leetcodeContestRating={leetcodeContestRating}
          codeforcesRating={codeforcesRating}
        />
      </div>
    </div>
  )
}
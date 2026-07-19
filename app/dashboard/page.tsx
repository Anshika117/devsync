export const dynamic = 'force-dynamic'
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import FolderGrid from "@/components/FolderGrid"
import CreateFolderButton from "@/components/CreateFolderButton"
import { syncNeedsRevisionFolder } from "@/lib/revisionEngine"
import { getDashboardStats } from "@/lib/dashboardStats"

// Folder names that should always float to the top of the dashboard,
// regardless of type/creation-date ordering — in this priority order.
const PINNED_FOLDER_NAMES = ["Needs Revision", "Revision"]

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  // Runs first (not inside the Promise.all below) because it can create the
  // "Needs Revision" folder — the folders query right after needs to see it.
  const { count: staleCount, folderId: needsRevisionFolderId } =
    await syncNeedsRevisionFolder(userId)

  const [folders, stats] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: { _count: { select: { problems: true, children: true } } },
      orderBy: [
        { order: "asc" }, // drag-and-drop position, set via /api/folder/reorder
        { type: "asc" }, // AUTO before CUSTOM alphabetically — tiebreaker for order:0 ties
        { createdAt: "asc" }
      ],
    }),
    getDashboardStats(userId),
  ])

  const { problemCount, difficultyCounts } = stats

  const sortedFolders = [...folders].sort((a, b) => {
    const aPin = PINNED_FOLDER_NAMES.indexOf(a.name)
    const bPin = PINNED_FOLDER_NAMES.indexOf(b.name)
    if (aPin === -1 && bPin === -1) return 0
    if (aPin === -1) return 1
    if (bPin === -1) return -1
    return aPin - bPin
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Welcome back 👋</h1>
      <p className="text-gray-400 mb-8">Logged in as {session.user.email}</p>

      {staleCount > 0 && needsRevisionFolderId && (
        <Link
          href={`/folders/${needsRevisionFolderId}`}
          className="mb-8 flex items-center gap-3 rounded-xl border border-orange-700/50 bg-orange-950/40 p-4 text-sm text-orange-200 hover:bg-orange-950/60 transition"
        >
          <span className="text-xl">🔥</span>
          <span>
            You have <strong>{staleCount}</strong> problem{staleCount !== 1 ? "s" : ""} not visited in
            over a month — head to <span className="underline font-semibold">Needs Revision</span> to catch up.
          </span>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">Problems Solved</h2>
          <p className="text-4xl font-bold text-blue-400">{problemCount}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">Folders</h2>
          <p className="text-4xl font-bold text-purple-400">{folders.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">By Difficulty</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-teal-400">Easy</span>
            <span className="font-bold text-white">{difficultyCounts.Easy}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="font-semibold text-yellow-400">Med.</span>
            <span className="font-bold text-white">{difficultyCounts.Medium}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="font-semibold text-red-400">Hard</span>
            <span className="font-bold text-white">{difficultyCounts.Hard}</span>
          </div>
        </div>
      </div>

      {/* Folders */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your Folders</h2>
        <CreateFolderButton />
      </div>
      <FolderGrid
        folders={sortedFolders}
        emptyMessage="No folders yet. Sync your LeetCode account to get started."
      />
    </div>
  )
}

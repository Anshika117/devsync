export const dynamic = 'force-dynamic'
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import FolderGrid from "@/components/FolderGrid"
import CreateFolderButton from "@/components/CreateFolderButton"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const [folders, problemCount] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: { _count: { select: { problems: true } } },
      orderBy: [
        { type: "asc" }, // AUTO before CUSTOM alphabetically
        { createdAt: "asc" }
      ],
    }),
    prisma.problem.count({ where: { userId } })
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">Welcome back 👋</h1>
      <p className="text-gray-400 mb-8">Logged in as {session.user.email}</p>

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
          <h2 className="text-lg font-semibold mb-1">Weekly Goal</h2>
          <p className="text-4xl font-bold text-green-400">0%</p>
        </div>
      </div>

      {/* Folders */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your Folders</h2>
        <CreateFolderButton />
      </div>
      <FolderGrid
        folders={folders}
        emptyMessage="No folders yet. Sync your LeetCode account to get started."
      />
    </div>
  )
}
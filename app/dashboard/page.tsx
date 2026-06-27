import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

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
        { type: "asc" },  // CUSTOM folders first (C comes before A alphabetically... wait no)
        { createdAt: "asc" }
      ],  }),
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
      <h2 className="text-xl font-bold mb-4">Your Folders</h2>
      {folders.length === 0 ? (
        <p className="text-gray-500">No folders yet. Sync your LeetCode account to get started.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map((folder: any)=>(
            <Link
              key={folder.id}
              href={`/folders/${folder.id}`}
              className="bg-gray-900 rounded-xl p-5 hover:bg-gray-800 transition cursor-pointer"
            >
              <div className="text-2xl mb-2">📁</div>
              <h3 className="font-semibold text-white">{folder.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {folder._count.problems} problems
              </p>
              <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                {folder.type}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
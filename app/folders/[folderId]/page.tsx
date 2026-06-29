import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ProblemList from "@/components/ProblemList"

interface Props {
  params: Promise<{ folderId: string }>
}

export default async function FolderPage({ params }: Props) {
  const { folderId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [folder, revisionFolder] = await Promise.all([
    prisma.folder.findFirst({
      where: { id: folderId, userId },
      include: {
        problems: {
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                url: true,
                platform: true,
                difficulty: true,
                tags: true,
                notes: true,
              }
            }
          }
        }
      }
    }),
    prisma.folder.findFirst({
      where: { userId, name: "Revision", type: "CUSTOM" },
      include: { problems: { select: { problemId: true } } }
    })
  ])

  if (!folder) notFound()

  const starredIds = new Set(
    revisionFolder?.problems.map(p => p.problemId) ?? []
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <Link href="/dashboard" className="text-gray-400 text-sm hover:text-white mb-6 inline-block">
        ← Back to Dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">📁</span>
        <h1 className="text-3xl font-bold">{folder.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
          {folder.type}
        </span>
      </div>
      <p className="text-gray-400 mb-8">{folder.problems.length} problems</p>

      <ProblemList
        problems={folder.problems.map(({ problem }: any) => problem)}
        initialStarred={Array.from(starredIds)}
      />
    </div>
  )
}

import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ProblemList from "@/components/ProblemList"
import DeleteFolderButton from "@/components/DeleteFolderButton"
import AddProblemModal from "@/components/AddProblemModal"
import RenameFolderButton from "@/components/RenameFolderButton"

interface Props {
  params: Promise<{ folderId: string }>
}

export default async function FolderPage({ params }: Props) {
  const { folderId } = await params

  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const [folder, revisionFolder, allFolders] = await Promise.all([
    prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
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
              },
            },
          },
        },
      },
    }),

    prisma.folder.findFirst({
      where: {
        userId,
        name: "Revision",
        type: "CUSTOM",
      },
      include: {
        problems: {
          select: {
            problemId: true,
          },
        },
      },
    }),

    prisma.folder.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ])

  if (!folder) {
    notFound()
  }

  const starredIds = new Set(
    revisionFolder?.problems.map((p) => p.problemId) ?? []
  )

  return (
    <div className="min-h-screen bg-gray-950 p-8 text-white">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-gray-400 hover:text-white"
      >
        ← Back to Dashboard
      </Link>

      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📁</span>

          <h1 className="text-3xl font-bold">{folder.name}</h1>

          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {folder.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RenameFolderButton
            folderId={folderId}
            currentName={folder.name}
          />

          <DeleteFolderButton
            folderId={folderId}
            folderName={folder.name}
            allFolders={allFolders.filter((f) => f.id !== folderId)}
          />
        </div>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <p className="text-gray-400">
          {folder.problems.length} problems
        </p>

        <AddProblemModal folderId={folderId} />
      </div>

      <ProblemList
        problems={folder.problems.map(({ problem }) => problem)}
        initialStarred={Array.from(starredIds)}
        currentFolderId={folderId}
        allFolders={allFolders}
      />
    </div>
  )
}

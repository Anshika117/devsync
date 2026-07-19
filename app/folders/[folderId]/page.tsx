import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ProblemList from "@/components/ProblemList"
import RevisionTopicGroups from "@/components/RevisionTopicGroups"
import DeleteFolderButton from "@/components/DeleteFolderButton"
import AddProblemModal from "@/components/AddProblemModal"
import RenameFolderButton from "@/components/RenameFolderButton"
import { FOLDER_PROBLEMS_PAGE_SIZE, paginate } from "@/lib/pagination"

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

  const PROBLEM_SELECT = {
    id: true,
    title: true,
    url: true,
    platform: true,
    difficulty: true,
    tags: true,
    notes: true,
  } as const

  const [folder, totalCount, revisionFolder, allFolders] = await Promise.all([
    prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true, name: true, type: true, parentId: true },
    }),

    prisma.folderProblem.count({ where: { folderId } }),

    prisma.folder.findFirst({
      where: { userId, name: "Revision", type: "CUSTOM" },
      include: { problems: { select: { problemId: true } } },
    }),

    prisma.folder.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ])

  if (!folder) {
    notFound()
  }

  // One-level nesting (see /api/folder/nest): a folder can have a parent, or
  // children, but never both — so these two queries never both come back
  // non-empty for the same folder. Run after the folder itself is known
  // since parentId isn't available until then.
  const [parentFolder, childFolders] = await Promise.all([
    folder.parentId
      ? prisma.folder.findFirst({
          where: { id: folder.parentId, userId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    prisma.folder.findMany({
      where: { parentId: folderId, userId },
      select: { id: true, name: true, _count: { select: { problems: true } } },
      orderBy: { order: "asc" },
    }),
  ])

  const isNeedsRevision = folder.name === "Needs Revision" && folder.type === "AUTO"
  // The starred "Revision" folder gets the same dismiss-checkbox behavior as
  // Needs Revision (see ProblemList.tsx's revisionDismiss prop) — clicking a
  // problem or its checkbox here unstars it, same effect as the ★ toggle.
  const isRevisionStarFolder = folder.name === "Revision" && folder.type === "CUSTOM"

  // "Needs Revision" isn't paginated the same way — it's grouped into topic
  // subfolders client-side (RevisionTopicGroups), and staleness/SM-2 rules
  // already keep this list naturally bounded in practice, so one larger
  // single fetch (200) is simpler than teaching the topic-grouping view to
  // page too. Every other folder gets real cursor pagination, since a topic
  // folder like "Array" can realistically grow into the hundreds over years
  // of solving problems.
  const firstPage = await prisma.folderProblem.findMany({
    where: { folderId },
    take: (isNeedsRevision ? 200 : FOLDER_PROBLEMS_PAGE_SIZE) + 1,
    orderBy: { createdAt: "asc" },
    select: { id: true, problem: { select: PROBLEM_SELECT } },
  })

  const pageSize = isNeedsRevision ? 200 : FOLDER_PROBLEMS_PAGE_SIZE
  const { items: pageItems, hasMore, nextCursor } = paginate(firstPage, pageSize)
  const problems = pageItems.map((r) => r.problem)

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

      {parentFolder && (
        <Link
          href={`/folders/${parentFolder.id}`}
          className="mb-2 ml-4 inline-block text-sm text-gray-500 hover:text-white"
        >
          ← Back to {parentFolder.name}
        </Link>
      )}

      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📁</span>

          <h1 className="text-3xl font-bold">{folder.name}</h1>

          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
            {folder.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RenameFolderButton folderId={folderId} currentName={folder.name} />

          <DeleteFolderButton
            folderId={folderId}
            folderName={folder.name}
            allFolders={allFolders.filter((f) => f.id !== folderId)}
          />
        </div>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <p className="text-gray-400">
          {totalCount} problem{totalCount !== 1 ? "s" : ""}
          {!isNeedsRevision && hasMore ? ` (showing first ${pageItems.length})` : ""}
        </p>

        <AddProblemModal folderId={folderId} />
      </div>

      {childFolders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Subfolders
            <span className="ml-2 text-gray-600 normal-case font-normal">
              ({childFolders.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {childFolders.map((child) => (
              <Link
                key={child.id}
                href={`/folders/${child.id}`}
                className="rounded-xl p-5 bg-gray-900 hover:bg-gray-800 transition"
              >
                <div className="text-2xl mb-2">📁</div>
                <h3 className="font-semibold text-white">{child.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {child._count.problems} problems
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isNeedsRevision ? (
        <RevisionTopicGroups
          problems={problems}
          initialStarred={Array.from(starredIds)}
          currentFolderId={folderId}
          allFolders={allFolders}
          folderId={folderId}
          initialHasMore={hasMore}
          initialNextCursor={nextCursor}
        />
      ) : (
        <ProblemList
          problems={problems}
          initialStarred={Array.from(starredIds)}
          currentFolderId={folderId}
          allFolders={allFolders}
          folderId={folderId}
          initialHasMore={hasMore}
          initialNextCursor={nextCursor}
          revisionDismiss={isRevisionStarFolder}
        />
      )}
    </div>
  )
}

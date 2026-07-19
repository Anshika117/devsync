import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { FOLDER_PROBLEMS_PAGE_SIZE, paginate } from "@/lib/pagination"

// "Load more" for a folder's problem list. Cursor-based, not offset-based:
// offset pagination (skip: N) makes Postgres walk and discard the first N
// rows on every request, which gets slower the deeper you page. A cursor
// (WHERE ... after this specific row) costs the same no matter how deep you
// are, because it's answered directly off the folderId index instead of by
// counting through everything before it.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { folderId } = await params
  const userId = session.user.id

  // Ownership check first and separate from the page query below — this is
  // an API route returning JSON directly to the caller, not a page that can
  // discard unauthorized data before rendering, so the check has to happen
  // before any folder-scoped data is fetched at all.
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 })
  }

  const cursor = new URL(req.url).searchParams.get("cursor")

  const rows = await prisma.folderProblem.findMany({
    where: { folderId },
    take: FOLDER_PROBLEMS_PAGE_SIZE + 1, // fetch one extra to know if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      problem: {
        select: {
          id: true, title: true, url: true, platform: true,
          difficulty: true, tags: true, notes: true,
        },
      },
    },
  })

  const { items, nextCursor } = paginate(rows, FOLDER_PROBLEMS_PAGE_SIZE)

  return NextResponse.json({
    problems: items.map((r) => r.problem),
    nextCursor,
  })
}

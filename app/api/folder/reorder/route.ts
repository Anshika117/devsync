import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, folderReorderSchema } from "@/lib/validation"

// Persists a drag-and-drop reorder from the dashboard's FolderGrid. Body is
// just the folder ids in their new left-to-right/top-to-bottom order —
// order values are assigned as array index. "Needs Revision" and "Revision"
// aren't draggable client-side (see FolderGrid.tsx) so they're never part
// of this list; they keep floating to the top via the existing pin logic
// in app/dashboard/page.tsx regardless of their stored `order` value.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseBody(folderReorderSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { folderIds } = parsed.data
  const userId = session.user.id

  // Ownership check — every id must belong to this user, or the whole
  // reorder is rejected rather than silently reordering a subset.
  const owned = await prisma.folder.findMany({
    where: { id: { in: folderIds }, userId },
    select: { id: true },
  })
  if (owned.length !== folderIds.length) {
    return NextResponse.json({ error: "One or more folders not found" }, { status: 404 })
  }

  await prisma.$transaction(
    folderIds.map((id, index) =>
      prisma.folder.update({ where: { id }, data: { order: index } })
    )
  )

  return NextResponse.json({ success: true })
}

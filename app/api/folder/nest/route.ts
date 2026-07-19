import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkCooldown } from "@/lib/rateLimit"
import { parseBody, folderNestSchema } from "@/lib/validation"

const NEST_COOLDOWN_S = 2

// Drag-and-drop nesting from FolderGrid.tsx (drop onto a folder's center).
// parentId: null means "un-nest" — promote this folder back to top-level.
// Deliberately capped at exactly one level deep (see schema.prisma's comment
// on Folder.parentId) via two checks that together also rule out any cycle:
//   1. The folder being nested must not already have children of its own —
//      otherwise nesting it would create a 2-level chain from its side.
//   2. The target parent must not itself already have a parent — otherwise
//      nesting into it would create a 2-level chain from the other side.
// A 2-folder cycle (A parent of B, B parent of A) is impossible under these
// rules: the moment A becomes parent of B, check 1 blocks A from ever being
// nested under B, and check 2 blocks B from ever being nested under A.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const parsed = parseBody(folderNestSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { folderId, parentId } = parsed.data

  const allowed = await checkCooldown("folder:nest", folderId, NEST_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "This folder was just moved — please wait a moment." },
      { status: 429 }
    )
  }

  // Un-nest: promote back to top-level. No cycle/depth checks needed.
  if (!parentId) {
    const result = await prisma.folder.updateMany({
      where: { id: folderId, userId },
      data: { parentId: null },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  }

  if (parentId === folderId) {
    return NextResponse.json({ error: "A folder can't be nested inside itself" }, { status: 400 })
  }

  const [folder, parent, childCount] = await Promise.all([
    prisma.folder.findFirst({ where: { id: folderId, userId } }),
    prisma.folder.findFirst({ where: { id: parentId, userId } }),
    prisma.folder.count({ where: { parentId: folderId } }),
  ])

  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 })
  if (!parent) return NextResponse.json({ error: "Target folder not found" }, { status: 404 })

  if (childCount > 0) {
    return NextResponse.json(
      { error: "This folder already has subfolders — it can't be nested inside another one too" },
      { status: 400 }
    )
  }
  if (parent.parentId) {
    return NextResponse.json(
      { error: "Can't nest inside a folder that's already nested — only one level is supported" },
      { status: 400 }
    )
  }

  await prisma.folder.update({
    where: { id: folderId },
    data: { parentId },
  })

  return NextResponse.json({ success: true })
}

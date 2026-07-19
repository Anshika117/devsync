import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkCooldown } from "@/lib/rateLimit"
import { parseBody, folderRenameSchema } from "@/lib/validation"

// Short, per-folder cooldown (not per-user like the sync routes' 5-minute
// one) — this isn't protecting an external API, it's just a guard against a
// double-click or a retried request firing the same rename twice in the
// same second. Scoped to the folder being renamed, not the user, so
// renaming two different folders back-to-back is never blocked.
const RENAME_COOLDOWN_S = 3

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(folderRenameSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { folderId, name } = parsed.data
  const userId = session.user.id

  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allowed = await checkCooldown("folder:rename", folderId, RENAME_COOLDOWN_S)
  if (!allowed) {
    return NextResponse.json(
      { error: "This folder was just renamed — please wait a moment and try again." },
      { status: 429 }
    )
  }

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: { name }
  })

  return NextResponse.json({ folder: updated })
}
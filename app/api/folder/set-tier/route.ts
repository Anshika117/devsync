import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, folderSetTierSchema } from "@/lib/validation"

// Called when a folder is dragged across dashboard sections (e.g. "Graph"
// dragged out of Intermediate and dropped into Advanced) — persists that as
// a manual override so the reclassification sticks on the next visit
// instead of the folder snapping back to its automatic tier on reload.
// Only AUTO folders participate in the tier system; CUSTOM folders live in
// their own section regardless of name, so this is scoped to type: "AUTO"
// the same way updateMany's { id, userId } scoping prevents touching
// someone else's folder (see DECISIONS.md's IDOR note for the same pattern
// used elsewhere).
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const parsed = parseBody(folderSetTierSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { folderId, tier } = parsed.data

  const result = await prisma.folder.updateMany({
    where: { id: folderId, userId, type: "AUTO" },
    data: { tierOverride: tier },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

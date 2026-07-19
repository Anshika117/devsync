import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { findOrCreateFolder } from "@/lib/folderUpsert"
import { parseBody, folderCreateSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(folderCreateSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { name } = parsed.data
  const userId = session.user.id

  // Case-insensitive find-or-create — otherwise a user could create "Google
  // Prep" and "google prep" as two separate CUSTOM folders by accident.
  const folder = await findOrCreateFolder(userId, name, "CUSTOM")

  return NextResponse.json({ folder })
}
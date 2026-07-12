import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { folderId, name } = await req.json()
  const userId = session.user.id

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } })
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: { name: name.trim() }
  })

  return NextResponse.json({ folder: updated })
}
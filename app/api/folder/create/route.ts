import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await req.json()
  const userId = session.user.id

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const folder = await prisma.folder.upsert({
    where: { userId_name_type: { userId, name: name.trim(), type: "CUSTOM" } },
    update: {},
    create: { name: name.trim(), type: "CUSTOM", userId }
  })

  return NextResponse.json({ folder })
}
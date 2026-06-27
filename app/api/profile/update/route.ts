import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { lcUsername, cfHandle } = await req.json()

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lcUsername, cfHandle }
  })

  return NextResponse.json({ success: true })
}
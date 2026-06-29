import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { problemId, notes } = await req.json()

  await prisma.problem.update({
    where: { id: problemId },
    data: { notes }
  })

  return NextResponse.json({ success: true })
}
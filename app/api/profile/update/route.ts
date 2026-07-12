import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { lcUsername, cfHandle, bufferDay } = await req.json()

  if (
    bufferDay !== undefined &&
    bufferDay !== null &&
    (typeof bufferDay !== "number" || bufferDay < 0 || bufferDay > 6)
  ) {
    return NextResponse.json({ error: "bufferDay must be 0-6 or null" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      lcUsername,
      cfHandle,
      ...(bufferDay !== undefined && { bufferDay }),
    }
  })

  return NextResponse.json({ success: true })
}

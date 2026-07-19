import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, profileUpdateSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = parseBody(profileUpdateSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { lcUsername, cfHandle, bufferDay } = parsed.data

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

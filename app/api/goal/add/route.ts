import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, goalAddSchema } from "@/lib/validation"

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(goalAddSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { title } = parsed.data
  const userId = session.user.id

  const goal = await prisma.dailyGoal.create({
    data: {
      userId,
      title,
      targetDate: startOfDay(new Date()),
    },
  })

  return NextResponse.json({ goal })
}

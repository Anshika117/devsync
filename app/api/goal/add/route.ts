import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title } = await req.json()
  const userId = session.user.id

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const goal = await prisma.dailyGoal.create({
    data: {
      userId,
      title: title.trim(),
      targetDate: startOfDay(new Date()),
    },
  })

  return NextResponse.json({ goal })
}

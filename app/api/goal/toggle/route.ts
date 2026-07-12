import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { goalId } = await req.json()
  const userId = session.user.id

  const goal = await prisma.dailyGoal.findFirst({ where: { id: goalId, userId } })
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

  const updated = await prisma.dailyGoal.update({
    where: { id: goalId },
    data: {
      done: !goal.done,
      completedAt: !goal.done ? new Date() : null,
    },
  })

  return NextResponse.json({ goal: updated })
}

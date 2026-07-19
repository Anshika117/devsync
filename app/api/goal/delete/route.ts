import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, goalIdSchema } from "@/lib/validation"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(goalIdSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { goalId } = parsed.data
  const userId = session.user.id

  // deleteMany (not delete) so userId is enforced in the WHERE clause —
  // same ownership pattern as notes/save, revision/toggle, problem/move.
  const result = await prisma.dailyGoal.deleteMany({ where: { id: goalId, userId } })
  if (result.count === 0) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, recurringGoalAddSchema } from "@/lib/validation"

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Creates a new entry in the "repeats every day" template. Also spawns
// today's DailyGoal instance immediately (rather than waiting for tomorrow's
// first ensureTodayRecurringGoals() call) so a goal added right now shows up
// in the current day's checklist without a day boundary having to pass.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(recurringGoalAddSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { title } = parsed.data
  const userId = session.user.id

  const recurringGoal = await prisma.recurringGoal.create({
    data: { userId, title },
  })

  await prisma.dailyGoal.create({
    data: {
      userId,
      title: recurringGoal.title,
      targetDate: startOfDay(new Date()),
      recurringGoalId: recurringGoal.id,
    },
  })

  return NextResponse.json({ recurringGoal })
}

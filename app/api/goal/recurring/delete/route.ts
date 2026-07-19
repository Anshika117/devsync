import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBody, recurringGoalDeleteSchema } from "@/lib/validation"

// Deletes only the template row. Existing DailyGoal instances — today's and
// any past day's — keep their own title/done state untouched (they store
// their own title directly rather than looking it up through the relation);
// the relation's onDelete: SetNull just clears their recurringGoalId. This
// only stops new days from getting a fresh instance going forward.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = parseBody(recurringGoalDeleteSchema, await req.json())
  if ("error" in parsed) return parsed.error
  const { recurringGoalId } = parsed.data
  const userId = session.user.id

  const result = await prisma.recurringGoal.deleteMany({ where: { id: recurringGoalId, userId } })
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { problemId, notes } = await req.json()
  const userId = session.user.id

  if (!problemId) {
    return NextResponse.json({ error: "problemId required" }, { status: 400 })
  }

  // updateMany (not update) so the userId is enforced in the WHERE clause —
  // update() only takes a unique identifier and would let any authenticated
  // user overwrite notes on a problem they don't own just by knowing its id.
  const result = await prisma.problem.updateMany({
    where: { id: problemId, userId },
    data: { notes }
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
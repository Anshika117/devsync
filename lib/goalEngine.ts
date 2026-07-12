import { prisma } from "@/lib/prisma"

const BUFFER_CAP_DAYS = 14

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Today's checklist — goals whose targetDate is today.
export async function getTodayGoals(userId: string) {
  const today = startOfDay(new Date())
  return prisma.dailyGoal.findMany({
    where: { userId, targetDate: today },
    orderBy: { createdAt: "asc" },
  })
}

// Goals whose day has passed, still not done, and within the 2-week cap.
// Nothing here is ever deleted by a background process — once a goal falls
// outside the window it just stops being returned by this query. Same
// "compute on read" choice as the revision engine, for the same reason:
// no scheduled-job infrastructure exists, so let the query define what's
// still relevant instead of needing something to clean up rows on a timer.
export async function getBufferGoals(userId: string) {
  const today = startOfDay(new Date())
  const cutoff = addDays(today, -BUFFER_CAP_DAYS)
  return prisma.dailyGoal.findMany({
    where: {
      userId,
      done: false,
      targetDate: { lt: today, gte: cutoff },
    },
    orderBy: { targetDate: "desc" },
  })
}

// Percent of goals completed on each day of the current week (Monday-start).
export async function getWeeklyCompletion(userId: string) {
  const today = startOfDay(new Date())
  const dayOfWeek = today.getDay() // 0 = Sunday ... 6 = Saturday
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const monday = addDays(today, -daysSinceMonday)
  const sunday = addDays(monday, 6)

  const goals = await prisma.dailyGoal.findMany({
    where: { userId, targetDate: { gte: monday, lte: sunday } },
    select: { targetDate: true, done: true },
  })

  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const dayGoals = goals.filter((g) => g.targetDate.getTime() === day.getTime())
    const total = dayGoals.length
    const done = dayGoals.filter((g) => g.done).length
    return {
      date: day,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      isToday: day.getTime() === today.getTime(),
      isFuture: day.getTime() > today.getTime(),
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      total,
      done,
    }
  })
}

// The entire "notification": true only if today matches the user's chosen
// buffer day AND there's actually something sitting in the buffer. No push
// service, no email, no cron — just a boolean a page checks on load.
export async function shouldShowBufferReminder(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bufferDay: true },
  })
  if (user?.bufferDay == null) return false
  if (new Date().getDay() !== user.bufferDay) return false

  const buffer = await getBufferGoals(userId)
  return buffer.length > 0
}

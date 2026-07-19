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

// Today's checklist — goals whose targetDate is today. Call
// ensureTodayRecurringGoals(userId) first (see below) so today's spawned
// instances already exist by the time this query runs.
export async function getTodayGoals(userId: string) {
  const today = startOfDay(new Date())
  return prisma.dailyGoal.findMany({
    where: { userId, targetDate: today },
    orderBy: { createdAt: "asc" },
  })
}

// The user-managed "repeats every day" template — see RecurringGoal in
// schema.prisma. Only active ones; a removed goal stops showing up here
// (and stops spawning new days) but its past DailyGoal rows are untouched.
export async function getRecurringGoals(userId: string) {
  return prisma.recurringGoal.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
  })
}

// Self-healing, same shape as revisionEngine.ts's syncNeedsRevisionFolder —
// no scheduled-job infrastructure exists in this app, so instead of a cron
// spawning each day's instances at midnight, this runs whenever the goals
// page loads and creates any of today's rows that don't exist yet for the
// user's active recurring goals. createMany + skipDuplicates leans on the
// (recurringGoalId, targetDate) unique constraint, so calling this more than
// once in the same day (two tabs open, a page refresh) is a safe no-op —
// nothing gets double-created.
export async function ensureTodayRecurringGoals(userId: string) {
  const today = startOfDay(new Date())
  const recurring = await prisma.recurringGoal.findMany({
    where: { userId, active: true },
    select: { id: true, title: true },
  })
  if (recurring.length === 0) return

  await prisma.dailyGoal.createMany({
    data: recurring.map((r) => ({
      userId,
      title: r.title,
      targetDate: today,
      recurringGoalId: r.id,
    })),
    skipDuplicates: true,
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

const STREAK_LOOKBACK_DAYS = 400

// Current consecutive-day streak: how many days in a row (ending today or
// yesterday) had at least one goal AND all of them checked off. A day with
// zero goals counts as a break, same as a day with unfinished ones — the
// streak is meant to reflect "showed up and finished what I set," not just
// "didn't fail anything because there was nothing to fail."
//
// Today is a special case: if it's not yet fully done (still in progress,
// or no goals added yet), it's skipped rather than treated as a break, so
// an unfinished "today" doesn't zero out a real streak built through
// yesterday. Once today is itself complete, it's counted like any other day.
export async function getGoalStreak(userId: string): Promise<number> {
  const today = startOfDay(new Date())
  const earliest = addDays(today, -STREAK_LOOKBACK_DAYS)

  const goals = await prisma.dailyGoal.findMany({
    where: { userId, targetDate: { gte: earliest, lte: today } },
    select: { targetDate: true, done: true },
  })

  const byDay = new Map<number, { total: number; done: number }>()
  for (const g of goals) {
    const key = g.targetDate.getTime()
    const entry = byDay.get(key) ?? { total: 0, done: 0 }
    entry.total += 1
    if (g.done) entry.done += 1
    byDay.set(key, entry)
  }

  function dayComplete(day: Date): boolean {
    const entry = byDay.get(day.getTime())
    return !!entry && entry.total > 0 && entry.done === entry.total
  }

  let streak = 0
  let cursor = today
  if (!dayComplete(cursor)) {
    cursor = addDays(cursor, -1)
  }
  while (dayComplete(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
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

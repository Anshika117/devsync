export const dynamic = 'force-dynamic'
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import {
  getTodayGoals,
  getBufferGoals,
  getWeeklyCompletion,
  shouldShowBufferReminder,
} from "@/lib/goalEngine"
import AddGoalInput from "@/components/AddGoalInput"
import GoalList from "@/components/GoalList"
import WeeklyGraph from "@/components/WeeklyGraph"
import BufferReminderPopup from "@/components/BufferReminderPopup"

export default async function GoalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [todayGoals, bufferGoals, weekly, showReminder] = await Promise.all([
    getTodayGoals(userId),
    getBufferGoals(userId),
    getWeeklyCompletion(userId),
    shouldShowBufferReminder(userId),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-3xl mx-auto">
      <BufferReminderPopup show={showReminder} count={bufferGoals.length} />

      <h1 className="text-3xl font-bold mb-8">Goals</h1>

      <div className="mb-10">
        <WeeklyGraph
          days={weekly.map(d => ({
            label: d.label,
            percent: d.percent,
            isToday: d.isToday,
            isFuture: d.isFuture,
          }))}
        />
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4">Today</h2>
        <AddGoalInput />
        <GoalList
          goals={todayGoals.map(g => ({
            id: g.id,
            title: g.title,
            done: g.done,
            targetDate: g.targetDate.toISOString(),
          }))}
          emptyMessage="No goals set for today yet — add one above."
        />
      </div>

      {bufferGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-1">🔥 Buffer List</h2>
          <p className="text-sm text-gray-400 mb-4">
            Goals from previous days that are not done yet. Drops off automatically after 2 weeks.
          </p>
          <GoalList
            goals={bufferGoals.map(g => ({
              id: g.id,
              title: g.title,
              done: g.done,
              targetDate: g.targetDate.toISOString(),
            }))}
            emptyMessage=""
            showDate
          />
        </div>
      )}
    </div>
  )
}

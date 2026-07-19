"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface RecurringGoal {
  id: string
  title: string
}

interface Props {
  goals: RecurringGoal[]
}

// Manages the recurring template itself — separate from the Today checklist
// rendered below it on the goals page, which just shows each day's spawned,
// checkable instances (see ensureTodayRecurringGoals in lib/goalEngine.ts).
// Adding here spawns today's instance immediately; removing here only stops
// future days from getting a new instance, it never touches an existing
// day's checkbox or history.
export default function WeeklyGoalsList({ goals: initialGoals }: Props) {
  const router = useRouter()
  const [goals, setGoals] = useState(initialGoals)
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!title.trim()) return
    setLoading(true)
    const res = await fetch("/api/goal/recurring/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    })
    setLoading(false)
    if (!res.ok) return

    const data = await res.json()
    setGoals((prev) => [...prev, { id: data.recurringGoal.id, title: data.recurringGoal.title }])
    setTitle("")
    // Picks up today's freshly-spawned instance in the checklist below.
    router.refresh()
  }

  async function handleRemove(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    await fetch("/api/goal/recurring/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurringGoalId: id }),
    })
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-1">Weekly Goals</h2>
      <p className="text-sm text-gray-400 mb-4">
        These repeat every day automatically — a fresh, unchecked copy shows up in Today each day.
      </p>

      <div className="flex gap-3 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a goal that repeats every day..."
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !title.trim()}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition"
        >
          {loading ? "Adding..." : "+ Add"}
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="text-gray-500 text-sm">No recurring goals yet — add one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2.5"
            >
              <span className="text-white text-sm">{goal.title}</span>
              <button
                onClick={() => handleRemove(goal.id)}
                className="text-gray-500 hover:text-red-400 transition cursor-pointer"
                title="Stop repeating this goal"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

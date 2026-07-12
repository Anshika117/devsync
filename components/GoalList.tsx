"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Goal {
  id: string
  title: string
  done: boolean
  targetDate: string
}

interface Props {
  goals: Goal[]
  emptyMessage: string
  showDate?: boolean
}

export default function GoalList({ goals: initialGoals, emptyMessage, showDate }: Props) {
  const router = useRouter()
  const [goals, setGoals] = useState(initialGoals)

  async function toggleGoal(id: string) {
    // Optimistic — flip immediately, revert if the server disagrees.
    setGoals(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g))

    const res = await fetch("/api/goal/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: id })
    })

    if (!res.ok) {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g))
      return
    }
    // Refresh so the weekly graph and buffer list (on the same page, or the
    // dashboard's stat card) reflect this change too, not just this list.
    router.refresh()
  }

  async function deleteGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id))
    await fetch("/api/goal/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: id })
    })
    router.refresh()
  }

  if (goals.length === 0) {
    return emptyMessage ? <p className="text-gray-500 text-sm">{emptyMessage}</p> : null
  }

  return (
    <div className="flex flex-col gap-2">
      {goals.map(goal => (
        <div key={goal.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
            <input
              type="checkbox"
              checked={goal.done}
              onChange={() => toggleGoal(goal.id)}
              className="w-4 h-4 accent-green-500 cursor-pointer shrink-0"
            />
            <span className={`truncate ${goal.done ? "line-through text-gray-500" : "text-white"}`}>
              {goal.title}
            </span>
          </label>
          <div className="flex items-center gap-3 shrink-0">
            {showDate && (
              <span className="text-xs text-gray-500">
                {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            <button
              onClick={() => deleteGoal(goal.id)}
              className="text-gray-500 hover:text-red-400 transition cursor-pointer"
              title="Delete goal"
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

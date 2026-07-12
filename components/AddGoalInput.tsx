"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AddGoalInput() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!title.trim()) return
    setLoading(true)
    await fetch("/api/goal/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() })
    })
    setTitle("")
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex gap-3 mb-4">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        placeholder="Add a goal for today..."
        className="flex-1 bg-gray-900 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button
        onClick={handleAdd}
        disabled={loading || !title.trim()}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition"
      >
        {loading ? "Adding..." : "+ Add"}
      </button>
    </div>
  )
}

"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Problem {
  id: string
  title: string
  url: string
  platform: string
  difficulty: string
  tags: string[]
  notes?: string | null
}

interface Props {
  problems: Problem[]
  initialStarred?: string[]
  currentFolderId?: string
  allFolders?: { id: string, name: string }[]
}

export default function ProblemList({ problems, initialStarred = [], currentFolderId, allFolders = [] }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState("All")
  const [starred, setStarred] = useState<Set<string>>(new Set(initialStarred))
  const [noteModal, setNoteModal] = useState<{ problemId: string, title: string, notes: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [localNotes, setLocalNotes] = useState<Record<string, string>>(
    Object.fromEntries(problems.map(p => [p.id, p.notes ?? ""]))
  )
  const [movingProblem, setMovingProblem] = useState<string | null>(null)

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchDiff = difficulty === "All" || p.difficulty === difficulty
    return matchSearch && matchDiff
  })

  const difficultyColor: Record<string, string> = {
    Easy: "text-green-400",
    Medium: "text-yellow-400",
    Hard: "text-red-400"
  }

  async function toggleRevision(problemId: string) {
    // Optimistic update — toggle immediately
    setStarred(prev => {
      const next = new Set(prev)
      next.has(problemId) ? next.delete(problemId) : next.add(problemId)
      return next
    })
    
    // Then sync with server
    const res = await fetch("/api/revision/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId })
    })
    const data = await res.json()
    
    // Correct if server disagrees
    setStarred(prev => {
      const next = new Set(prev)
      data.starred ? next.add(problemId) : next.delete(problemId)
      return next
    })
  }

  async function saveNote() {
    if (!noteModal) return
    setSaving(true)
    await fetch("/api/notes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: noteModal.problemId, notes: noteModal.notes })
    })
    setLocalNotes(prev => ({ ...prev, [noteModal.problemId]: noteModal.notes }))
    setSaving(false)
    setNoteModal(null)
  }

  function markViewed(problemId: string) {
    // Best-effort, fire-and-forget — this shouldn't block or interrupt the
    // browser opening the problem link in a new tab.
    fetch("/api/problem/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId })
    }).catch(() => {})
  }

  async function moveProblem(problemId: string, toFolderId: string) {
    await fetch("/api/problem/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, fromFolderId: currentFolderId, toFolderId })
    })
    setMovingProblem(null)
    router.refresh()
  }

  return (
    <div>
      {/* Notes Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Notes — {noteModal.title}</h2>
              <button onClick={() => setNoteModal(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <textarea
              value={noteModal.notes}
              onChange={e => setNoteModal({ ...noteModal, notes: e.target.value })}
              placeholder="Enter a note... e.g. used sliding window, remember edge case when array is empty"
              className="w-full bg-gray-800 text-white rounded-xl p-4 h-48 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">{noteModal.notes.length}/2000</span>
              <div className="flex gap-3">
                <button onClick={() => setNoteModal(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition text-sm">Cancel</button>
                <button onClick={saveNote} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-semibold">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search problems..."
          className="flex-1 bg-gray-900 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />
        {["All", "Easy", "Medium", "Hard"].map(d => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              difficulty === d ? "bg-blue-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        {filtered.length} problem{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Problem Cards */}
      <div className="flex flex-col gap-3">
        {filtered.map(problem => (
          <div key={problem.id} className="bg-gray-900 rounded-xl p-5 flex items-center justify-between hover:bg-gray-800 transition">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-500 text-black">
                {problem.platform === "LeetCode" ? "LC" : problem.platform === "Codeforces" ? "CF" : "CC"}
              </span>
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markViewed(problem.id)}
                className="font-semibold text-white hover:text-blue-400 transition"
              >
                {problem.title}
              </a>
              {localNotes[problem.id] && (
                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">note</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex gap-2">
                {problem.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{tag}</span>
                ))}
              </div>
              <span className={`text-sm font-semibold ${difficultyColor[problem.difficulty] ?? "text-gray-400"}`}>
                {problem.difficulty}
              </span>

              {/* Notes */}
              <button
                onClick={() => setNoteModal({ problemId: problem.id, title: problem.title, notes: localNotes[problem.id] ?? "" })}
                className="text-gray-500 hover:text-blue-400 transition cursor-pointer"
                title="Add note"
              >
                📝
              </button>

              {/* Move to folder */}
              {allFolders.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setMovingProblem(movingProblem === problem.id ? null : problem.id)}
                    className="text-gray-500 hover:text-white transition cursor-pointer"
                    title="Move to folder"
                  >
                    📂
                  </button>
                  {movingProblem === problem.id && (
                    <div className="absolute right-0 top-8 bg-gray-800 rounded-xl shadow-xl z-10 min-w-44 overflow-hidden border border-gray-700">
                      <p className="text-xs text-gray-400 px-3 py-2 border-b border-gray-700">Move to:</p>
                      {allFolders.filter(f => f.id !== currentFolderId).map(f => (
                        <button
                          key={f.id}
                          onClick={() => moveProblem(problem.id, f.id)}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition"
                        >
                          📁 {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Revision star */}
              <button
                onClick={() => toggleRevision(problem.id)}
                className={`transition text-3xl cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-700 ${starred.has(problem.id) ? "text-yellow-400" : "text-gray-500 hover:text-yellow-400"}`}              >
                {starred.has(problem.id) ? "★" : "☆"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
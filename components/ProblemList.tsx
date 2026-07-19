"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QUALITY } from "@/lib/spacedRepetition"

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
  // Pagination — all optional so ProblemList still works as a plain flat
  // list wherever it's used without a paginated source (e.g. inside
  // RevisionTopicGroups, which fetches its own bounded set up front).
  folderId?: string
  initialHasMore?: boolean
  initialNextCursor?: string | null
  // True only when this list is rendered inside the Needs Revision or
  // Revision (starred) folder views. Turns on the dismiss checkbox and
  // makes clicking a problem's title also dismiss it from that folder —
  // behavior that would make no sense in a regular topic folder, where
  // opening a problem obviously shouldn't remove it from the folder.
  revisionDismiss?: boolean
}

export default function ProblemList({
  problems,
  initialStarred = [],
  currentFolderId,
  allFolders = [],
  folderId,
  initialHasMore = false,
  initialNextCursor = null,
  revisionDismiss = false,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState("All")
  const [starred, setStarred] = useState<Set<string>>(new Set(initialStarred))
  const [noteModal, setNoteModal] = useState<{ problemId: string, title: string, notes: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadedProblems, setLoadedProblems] = useState<Problem[]>(problems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [localNotes, setLocalNotes] = useState<Record<string, string>>(
    Object.fromEntries(problems.map(p => [p.id, p.notes ?? ""]))
  )
  const [movingProblem, setMovingProblem] = useState<string | null>(null)
  const [reviewingProblem, setReviewingProblem] = useState<string | null>(null)
  const [folderSearch, setFolderSearch] = useState("")

  // "Load more" appends the next page instead of replacing anything — search
  // and difficulty filters below run over whatever's been loaded so far, the
  // same "search current results" tradeoff most paginated lists make.
  async function loadMore() {
    if (!folderId || !nextCursor || loadingMore) return
    setLoadingMore(true)
    const res = await fetch(`/api/folder/${folderId}/problems?cursor=${nextCursor}`)
    if (!res.ok) {
      toast.error("Couldn't load more problems — try again.")
      setLoadingMore(false)
      return
    }
    const data = await res.json()
    setLoadedProblems(prev => [...prev, ...data.problems])
    setLocalNotes(prev => ({
      ...prev,
      ...Object.fromEntries(data.problems.map((p: Problem) => [p.id, p.notes ?? ""])),
    }))
    setHasMore(data.nextCursor !== null)
    setNextCursor(data.nextCursor)
    setLoadingMore(false)
  }

  const filtered = loadedProblems.filter(p => {
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
    const res = await fetch("/api/notes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: noteModal.problemId, notes: noteModal.notes })
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Failed to save notes")
      return
    }

    setLocalNotes(prev => ({ ...prev, [noteModal.problemId]: noteModal.notes }))
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

  // Only ever called when revisionDismiss is true (Needs Revision / Revision
  // views). Deliberately not SM-2 — no quality rating, just "stop showing me
  // this." Removes it from local state immediately rather than waiting for
  // a refresh, since the server-side removal is already immediate (the API
  // deletes the FolderProblem link directly, not via the Needs Revision
  // cache — see the route's own comments).
  async function dismissFromRevision(problemId: string) {
    if (!currentFolderId) return
    const res = await fetch("/api/problem/dismiss-revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, folderId: currentFolderId })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Couldn't update that")
      return
    }
    setLoadedProblems(prev => prev.filter(p => p.id !== problemId))
  }

  async function moveProblem(problemId: string, toFolderId: string) {
    const res = await fetch("/api/problem/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, fromFolderId: currentFolderId, toFolderId })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Failed to move problem")
      return
    }

    setMovingProblem(null)
    setFolderSearch("")
    router.refresh()
  }

  // SM-2 rating — "Again/Hard/Good/Easy" map to the 0-5 scale the API
  // expects. Schedules the next review date, which is what the "Needs
  // Revision" folder actually reads once a problem has been rated at least
  // once (see revisionEngine.ts).
  async function reviewProblem(problemId: string, quality: number) {
    setReviewingProblem(null)
    const res = await fetch("/api/problem/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, quality })
    })
    if (!res.ok) {
      toast.error("Couldn't save that review — try again.")
      return
    }
    const data = await res.json()
    const days = data.intervalDays
    toast.success(`Next review in ${days} day${days !== 1 ? "s" : ""}.`)
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
              {revisionDismiss && (
                <input
                  type="checkbox"
                  onChange={() => dismissFromRevision(problem.id)}
                  title="Mark reviewed and remove from this list"
                  className="w-4 h-4 accent-purple-500 cursor-pointer"
                />
              )}
              <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-500 text-black">
                {problem.platform === "LeetCode" ? "LC" : problem.platform === "Codeforces" ? "CF" : "CC"}
              </span>
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  markViewed(problem.id)
                  // Clicking through counts as "reviewed it" the same as the
                  // checkbox, in this context only — see revisionDismiss doc.
                  if (revisionDismiss) dismissFromRevision(problem.id)
                }}
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
                    onClick={() => {
                      setMovingProblem(movingProblem === problem.id ? null : problem.id)
                      setFolderSearch("")
                    }}
                    className="text-gray-500 hover:text-white transition cursor-pointer"
                    title="Move to folder"
                  >
                    📂
                  </button>
                  {movingProblem === problem.id && (
                    <div className="absolute right-0 top-8 bg-gray-800 rounded-xl shadow-xl z-10 min-w-52 overflow-hidden border border-gray-700">
                      <div className="border-b border-gray-700 p-2">
                        <input
                          autoFocus
                          value={folderSearch}
                          onChange={e => setFolderSearch(e.target.value)}
                          placeholder="Search folders..."
                          className="w-full bg-gray-900 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {(() => {
                          const moveTargets = allFolders
                            .filter(f => f.id !== currentFolderId)
                            .filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase()))
                          if (moveTargets.length === 0) {
                            return <p className="px-3 py-2 text-xs text-gray-500">No folders match.</p>
                          }
                          return moveTargets.map(f => (
                            <button
                              key={f.id}
                              onClick={() => moveProblem(problem.id, f.id)}
                              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition"
                            >
                              📁 {f.name}
                            </button>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Spaced-repetition review */}
              <div className="relative">
                <button
                  onClick={() => setReviewingProblem(reviewingProblem === problem.id ? null : problem.id)}
                  className="text-gray-500 hover:text-purple-400 transition cursor-pointer"
                  title="Rate recall (spaced repetition)"
                >
                  🧠
                </button>
                {reviewingProblem === problem.id && (
                  <div className="absolute right-0 top-8 bg-gray-800 rounded-xl shadow-xl z-10 min-w-56 p-2 border border-gray-700">
                    <p className="text-xs text-gray-400 px-1 pb-2">How well did you recall this?</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => reviewProblem(problem.id, QUALITY.AGAIN)}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-950 text-red-300 hover:bg-red-900 transition cursor-pointer"
                      >
                        Again
                      </button>
                      <button
                        onClick={() => reviewProblem(problem.id, QUALITY.HARD)}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-orange-950 text-orange-300 hover:bg-orange-900 transition cursor-pointer"
                      >
                        Hard
                      </button>
                      <button
                        onClick={() => reviewProblem(problem.id, QUALITY.GOOD)}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-blue-950 text-blue-300 hover:bg-blue-900 transition cursor-pointer"
                      >
                        Good
                      </button>
                      <button
                        onClick={() => reviewProblem(problem.id, QUALITY.EASY)}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-green-950 text-green-300 hover:bg-green-900 transition cursor-pointer"
                      >
                        Easy
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition text-sm font-semibold cursor-pointer"
          >
            {loadingMore ? "Loading..." : "Load more problems"}
          </button>
        </div>
      )}
    </div>
  )
}
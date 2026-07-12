"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  folderId: string
}

export default function AddProblemModal({ folderId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [difficulty, setDifficulty] = useState("Medium")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function detectPlatform(u: string) {
    if (u.includes("leetcode.com")) return "LeetCode"
    if (u.includes("codeforces.com")) return "Codeforces"
    if (u.includes("codechef.com")) return "CodeChef"
    return "Other"
  }

  async function handleAdd() {
    if (!title.trim() || !url.trim()) {
      setError("Title and URL are required")
      return
    }
    setLoading(true)
    setError("")
    const res = await fetch("/api/problem/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId,
        title: title.trim(),
        url: url.trim(),
        difficulty,
        platform: detectPlatform(url),
        tags: []
      })
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setLoading(false)
      return
    }
    setLoading(false)
    setOpen(false)
    setTitle("")
    setUrl("")
    // router.refresh() re-runs the folder page's server-side data fetch and
    // patches the DOM in place — no full page reload, no lost client state.
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
      >
        + Add Problem
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Problem</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Problem URL</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://leetcode.com/problems/two-sum/"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Problem Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Two Sum"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none text-sm"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancel</button>
              <button onClick={handleAdd} disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">
                {loading ? "Adding..." : "Add Problem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
"use client"
import { useState } from "react"

interface Problem {
  id: string
  title: string
  url: string
  platform: string
  difficulty: string
  tags: string[]
}

interface Props {
  problems: Problem[]
}

export default function ProblemList({ problems }: Props) {
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState("All")
  const [starred, setStarred] = useState<Set<string>>(new Set())

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
    const res = await fetch("/api/revision/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId })
    })
    const data = await res.json()
    setStarred(prev => {
      const next = new Set(prev)
      data.starred ? next.add(problemId) : next.delete(problemId)
      return next
    })
  }

  return (
    <div>
      {/* Search + Filter bar */}
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
              difficulty === d
                ? "bg-blue-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Count */}
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
              <a href={problem.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-blue-400 transition">
                {problem.title}
              </a>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex gap-2">
                {problem.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
              <span className={`text-sm font-semibold ${difficultyColor[problem.difficulty] ?? "text-gray-400"}`}>
                {problem.difficulty}
              </span>
              <button
                onClick={() => toggleRevision(problem.id)}
                className={`transition text-xl ${starred.has(problem.id) ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"}`}
              >
                {starred.has(problem.id) ? "★" : "☆"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
"use client"
import { useState } from "react"

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"menu" | "hint" | "result">("menu")
  const [problemStatement, setProblemStatement] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    context: string
    hints: string[]
    similarToSolved: string
    source: string
  } | null>(null)
  const [error, setError] = useState("")

  async function getHint() {
    if (!problemStatement.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemStatement })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      setResult(data)
      setMode("result")
    } catch {
      setError("Something went wrong. Try again.")
    }
    setLoading(false)
  }

  function reset() {
    setMode("menu")
    setResult(null)
    setProblemStatement("")
    setError("")
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setOpen(true); setMode("menu") }}
        className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition z-40 text-2xl"
        title="AI Assistant"
      >
        🤖
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <h2 className="text-lg font-bold text-white">AI Assistant</h2>
              </div>
              <button onClick={() => { setOpen(false); reset() }} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>

            {/* Menu */}
            {mode === "menu" && (
              <div className="p-6 flex flex-col gap-4">
                <p className="text-gray-400 text-sm">What do you need help with?</p>
                <button
                  onClick={() => setMode("hint")}
                  className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-left transition"
                >
                  <div className="text-lg mb-1">💡 Get Hint</div>
                  <div className="text-xs text-gray-400">Paste a problem statement → get personalized hints based on your solving history</div>
                </button>
                <button
                  disabled
                  className="bg-gray-800 rounded-xl p-4 text-left opacity-40 cursor-not-allowed"
                >
                  <div className="text-lg mb-1">🎨 Visualiser</div>
                  <div className="text-xs text-gray-400">Coming soon — visual breakdown of any problem</div>
                </button>
              </div>
            )}

            {/* Hint Input */}
            {mode === "hint" && (
              <div className="p-6">
                <button onClick={() => setMode("menu")} className="text-gray-400 text-sm hover:text-white mb-4 inline-block">← Back</button>
                <p className="text-white font-semibold mb-3">Paste the problem statement:</p>
                <textarea
                  value={problemStatement}
                  onChange={e => setProblemStatement(e.target.value)}
                  placeholder="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target..."
                  className="w-full bg-gray-800 text-white rounded-xl p-4 h-40 outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                <button
                  onClick={getHint}
                  disabled={loading || !problemStatement.trim()}
                  className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                >
                  {loading ? "Analysing your profile + generating hints..." : "Get Personalised Hints"}
                </button>
              </div>
            )}

            {/* Result */}
            {mode === "result" && result && (
              <div className="p-6">
                {result.source === "cache" && (
                  <div className="text-xs bg-green-900 text-green-300 px-3 py-1 rounded-full inline-block mb-4">
                    ⚡ Served from cache
                  </div>
                )}

                {result.similarToSolved && (
                  <div className="bg-blue-900/40 border border-blue-700 rounded-xl p-4 mb-4">
                    <p className="text-blue-300 text-sm">🔗 {result.similarToSolved}</p>
                  </div>
                )}

                <div className="bg-gray-800 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Context</p>
                  <p className="text-white text-sm">{result.context}</p>
                </div>

                <div className="flex flex-col gap-3 mb-4">
                  {result.hints.map((hint, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-purple-400 mb-2 font-semibold">Hint {i + 1}</p>
                      <p className="text-white text-sm">{hint}</p>
                    </div>
                  ))}
                </div>

                <button onClick={reset} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition">
                  Try another problem
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  lcUsername: string
  cfHandle: string
  bufferDay: number | null
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function ProfileForm({ lcUsername, cfHandle, bufferDay }: Props) {
  const router = useRouter()
  const [lc, setLc] = useState(lcUsername)
  const [cf, setCf] = useState(cfHandle)
  const [buffer, setBuffer] = useState<number | null>(bufferDay)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lcUsername: lc, cfHandle: cf, bufferDay: buffer })
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSync(platform: "leetcode" | "codeforces") {
    const username = platform === "leetcode" ? lc : cf
    if (!username?.trim()) {
      toast.error(`Enter your ${platform === "leetcode" ? "LeetCode username" : "Codeforces handle"} first`)
      return
    }

    const res = await fetch(`/api/sync/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || `${platform === "leetcode" ? "LeetCode" : "Codeforces"} sync failed to start`)
      return
    }

    // Both sync routes run in the background (see /api/sync/*) and respond
    // immediately, so there's nothing to await here — just tell the user and
    // send them to the dashboard, which reflects new data once the background
    // job finishes (usually a few seconds).
    toast.success(
      `${platform === "leetcode" ? "LeetCode" : "Codeforces"} sync started — your dashboard will update in a few seconds.`
    )
    // router.push (Next's client-side navigation) instead of a hard redirect
    // — keeps the already-loaded JS running instead of reloading the browser.
    router.push("/dashboard")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* LeetCode */}
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">LeetCode</h2>
        <input
          value={lc}
          onChange={e => setLc(e.target.value)}
          placeholder="Your LeetCode username"
          className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => handleSync("leetcode")}
          className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-yellow-400 transition"
        >
          Sync LeetCode
        </button>
      </div>

      {/* Codeforces */}
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Codeforces</h2>
        <input
          value={cf}
          onChange={e => setCf(e.target.value)}
          placeholder="Your Codeforces handle"
          className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => handleSync("codeforces")}
          className="bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-400 transition"
        >
          Sync Codeforces
        </button>
      </div>

      {/* Buffer day */}
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Buffer Day</h2>
        <p className="text-sm text-gray-400 mb-4">
          The day a reminder pops up if you have unfinished goals sitting in your buffer list.
        </p>
        <select
          value={buffer ?? ""}
          onChange={e => setBuffer(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Not set</option>
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-500 transition"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
      </button>
    </div>
  )
}
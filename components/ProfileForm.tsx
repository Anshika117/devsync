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
  const [merging, setMerging] = useState(false)

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

  async function handleMergeDuplicates() {
    setMerging(true)
    try {
      const res = await fetch("/api/folder/merge-duplicates", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Merge failed")
        return
      }
      if (data.mergedGroups === 0) {
        toast.success("No duplicate folders found — you're all set.")
      } else {
        toast.success(
          `Merged ${data.mergedGroups} duplicate folder pair(s), moved ${data.movedProblems} problem(s), removed ${data.deletedFolders} folder(s).`
        )
      }
      router.refresh()
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Sync sources */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Sync Sources
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <h3 className="text-base font-semibold">LeetCode</h3>
            </div>
            <input
              value={lc}
              onChange={e => setLc(e.target.value)}
              placeholder="Your LeetCode username"
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white mb-4 text-sm outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button
              onClick={() => handleSync("leetcode")}
              className="w-full bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-yellow-400 transition text-sm cursor-pointer"
            >
              Sync LeetCode
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-base font-semibold">Codeforces</h3>
            </div>
            <input
              value={cf}
              onChange={e => setCf(e.target.value)}
              placeholder="Your Codeforces handle"
              className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white mb-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleSync("codeforces")}
              className="w-full bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-400 transition text-sm cursor-pointer"
            >
              Sync Codeforces
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 bg-green-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-green-500 transition text-sm cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
        </button>
      </section>

      {/* Preferences */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Preferences
        </h2>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-base font-semibold mb-1">Buffer Day Reminder</h3>
          <p className="text-sm text-gray-400 mb-4">
            The day a reminder pops up if you have unfinished goals sitting in your buffer list.
          </p>
          <select
            value={buffer ?? ""}
            onChange={e => setBuffer(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Not set</option>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Maintenance */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Maintenance
        </h2>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-base font-semibold mb-1">Clean Up Duplicate Folders</h3>
          <p className="text-sm text-gray-400 mb-4">
            If syncing before this fix left you with two folders for the same topic
            (like &ldquo;Binary Search&rdquo; and &ldquo;binary search&rdquo;), run this once to merge them —
            problems get moved into the older folder and the duplicate is deleted.
            Safe to run anytime; it&apos;s a no-op if there&apos;s nothing to merge.
          </p>
          <button
            onClick={handleMergeDuplicates}
            disabled={merging}
            className="bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-500 transition disabled:opacity-50 text-sm cursor-pointer"
          >
            {merging ? "Merging..." : "Clean up duplicate folders"}
          </button>
        </div>
      </section>
    </div>
  )
}
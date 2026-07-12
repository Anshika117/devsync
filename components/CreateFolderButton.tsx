"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateFolderButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    await fetch("/api/folder/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    })
    setLoading(false)
    setOpen(false)
    setName("")
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition"
      >
        + New Folder
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-4">Create Folder</h2>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Google Interview Prep"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={loading} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold">
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
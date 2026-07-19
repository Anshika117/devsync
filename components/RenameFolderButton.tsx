"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  folderId: string
  currentName: string
}

export default function RenameFolderButton({ folderId, currentName }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRename() {
    if (!name.trim() || name === currentName) return
    setLoading(true)
    const res = await fetch("/api/folder/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, name })
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Rename failed")
      return
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
      >
        ✏️ Rename
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-4">Rename Folder</h2>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancel</button>
              <button onClick={handleRename} disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
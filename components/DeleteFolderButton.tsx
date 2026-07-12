"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  folderId: string
  folderName: string
  allFolders: { id: string, name: string }[]
}

export default function DeleteFolderButton({ folderId, folderName, allFolders }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [action, setAction] = useState<"delete_problems" | "move_problems">("delete_problems")
  const [targetFolderId, setTargetFolderId] = useState(allFolders[0]?.id ?? "")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await fetch("/api/folder/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, action, targetFolderId })
    })
    setLoading(false)
    setShowModal(false)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition"
      >
        🗑 Delete Folder
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-2">Delete "{folderName}"?</h2>
            <p className="text-gray-400 text-sm mb-6">What should happen to the problems inside?</p>

            <div className="flex flex-col gap-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={action === "delete_problems"}
                  onChange={() => setAction("delete_problems")}
                  className="mt-1"
                />
                <div>
                  <p className="text-white text-sm font-semibold">Delete problems too</p>
                  <p className="text-gray-400 text-xs">Remove all problems that only exist in this folder</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={action === "move_problems"}
                  onChange={() => setAction("move_problems")}
                  className="mt-1"
                />
                <div>
                  <p className="text-white text-sm font-semibold">Move problems to another folder</p>
                  <p className="text-gray-400 text-xs">Keep the problems, just move them first</p>
                </div>
              </label>

              {action === "move_problems" && (
                <select
                  value={targetFolderId}
                  onChange={e => setTargetFolderId(e.target.value)}
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 ml-6 outline-none"
                >
                  {allFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition text-sm font-semibold"
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
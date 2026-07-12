"use client"
import { useState } from "react"
import Link from "next/link"

interface Folder {
  id: string
  name: string
  type: string
  _count: { problems: number }
}

interface Props {
  folders: Folder[]
  emptyMessage?: string
}

export default function FolderGrid({ folders, emptyMessage }: Props) {
  const [search, setSearch] = useState("")

  const filtered = folders.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  if (folders.length === 0) {
    return <p className="text-gray-500">{emptyMessage ?? "No folders yet."}</p>
  }

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search folders..."
        className="w-full bg-gray-900 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 mb-6 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-gray-500">No folders match "{search}".</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filtered.map(folder => {
            const isNeedsRevision = folder.name === "Needs Revision"
            return (
              <Link
                key={folder.id}
                href={`/folders/${folder.id}`}
                className={`rounded-xl p-5 transition cursor-pointer ${
                  isNeedsRevision
                    ? "bg-orange-950/40 border border-orange-700/60 hover:bg-orange-950/60"
                    : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                <div className="text-2xl mb-2">{isNeedsRevision ? "🔥" : "📁"}</div>
                <h3 className="font-semibold text-white">{folder.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {folder._count.problems} problems
                </p>
                <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {folder.type}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { getFolderTier, type FolderTier } from "@/lib/tagNormalizer"

type TierOverride = "ADVANCED" | "INTERMEDIATE" | "FUNDAMENTALS" | null

interface Folder {
  id: string
  name: string
  type: string
  tierOverride?: TierOverride
  parentId?: string | null
  _count: { problems: number; children?: number }
}

interface Props {
  folders: Folder[]
  emptyMessage?: string
}

// These two are system-managed (built by revisionEngine.ts / the ★ toggle,
// not created by the user) and always float to the top in their own row,
// regardless of drag order. Excluded from dragging so a user can't
// accidentally bury them.
const PINNED_FOLDER_NAMES = ["Needs Revision", "Revision"]

type Section = FolderTier | "custom"

const SECTION_ORDER: Section[] = ["advanced", "intermediate", "fundamentals", "custom"]

const SECTION_LABELS: Record<Section, string> = {
  advanced: "Advanced",
  intermediate: "Intermediate",
  fundamentals: "Fundamentals & Other",
  custom: "Custom",
}

// A folder's section is its manual tierOverride if one's been set (dragged
// across sections previously — see reorderLocally/persistOrder below),
// otherwise the automatic classification from its name. CUSTOM folders never
// participate in the tier system regardless of override.
function sectionOf(folder: Folder): Section {
  if (folder.type === "CUSTOM") return "custom"
  if (folder.tierOverride) return folder.tierOverride.toLowerCase() as FolderTier
  return getFolderTier(folder.name)
}

// Was one flat grid of every folder — AUTO, CUSTOM, pinned — in whatever
// order `order` said. With 30-40+ possible AUTO topic folders, that reads as
// a wall of identical tiles with no structure. Grouping into labeled
// sections (reusing the same Advanced/Intermediate tier lists getPrimaryTag()
// already uses to assign folders during sync, so the grouping always agrees
// with how folders were created) gives the dashboard actual hierarchy
// instead of alphabetical-soup-by-accident.
//
// One-level nesting (see /api/folder/nest) layers on top of this: only
// top-level folders (parentId null) get a full draggable tile and their own
// section slot. A folder with a parentId is rendered as a small chip inside
// its parent's tile instead — never as a separate top-level tile — since a
// child folder can't itself have children (the one-level rule).
export default function FolderGrid({ folders, emptyMessage }: Props) {
  const [search, setSearch] = useState("")
  const [items, setItems] = useState(folders)
  const [dragId, setDragId] = useState<string | null>(null)
  const [nestTargetId, setNestTargetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [unnesting, setUnnesting] = useState<string | null>(null)

  // Re-sync when the server sends fresh folders (new folder created,
  // deleted, or a page reload picks up the persisted order).
  useEffect(() => {
    setItems(folders)
  }, [folders])

  const dragEnabled = search === ""

  // Dragging within a section just reorders position, same as before.
  // Dragging *across* tier sections (Intermediate -> Advanced, etc.) is
  // treated as "I consider this folder Advanced, not Intermediate" — a
  // manual override to the automatic name-based classification — and is
  // allowed for AUTO folders. Custom is excluded both ways: a topic folder
  // dropped into Custom, or a Custom folder dragged into a tier section,
  // wouldn't mean anything, since Custom folders aren't organized by
  // perceived difficulty at all.
  function reorderLocally(overId: string) {
    if (!dragId || dragId === overId) return
    const dragged = items.find((f) => f.id === dragId)
    const target = items.find((f) => f.id === overId)
    if (!dragged || !target) return
    if (dragged.parentId || target.parentId) return // nested folders don't reorder/retier

    const draggedSection = sectionOf(dragged)
    const targetSection = sectionOf(target)
    const crossingTiers = draggedSection !== targetSection

    if (crossingTiers && (dragged.type === "CUSTOM" || targetSection === "custom")) {
      return
    }

    setItems((prev) => {
      const from = prev.findIndex((f) => f.id === dragId)
      const to = prev.findIndex((f) => f.id === overId)
      if (from === -1 || to === -1) return prev

      let next = [...prev]
      if (crossingTiers) {
        // Reclassify immediately in local state so the tile visually jumps
        // into its new section right away, mid-drag — persisted once the
        // drag actually ends (see persistOrder), same "optimistic update,
        // persist on drop" shape the position-reorder already used.
        const newTier = targetSection.toUpperCase() as TierOverride
        next = next.map((f) => (f.id === dragId ? { ...f, tierOverride: newTier } : f))
      }

      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function persistOrder() {
    const draggedFolderId = dragId
    const nestTarget = nestTargetId
    setDragId(null)
    setNestTargetId(null)

    // Dropped onto another folder's center: nest, don't reorder/retier.
    if (draggedFolderId && nestTarget) {
      setItems((prev) =>
        prev.map((f) => (f.id === draggedFolderId ? { ...f, parentId: nestTarget } : f))
      )
      setSaving(true)
      const res = await fetch("/api/folder/nest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: draggedFolderId, parentId: nestTarget }),
      }).catch(() => null)
      setSaving(false)
      if (!res || !res.ok) {
        const data = await res?.json().catch(() => ({})) ?? {}
        toast.error(data.error || "Couldn't nest that folder.")
        setItems(folders) // revert optimistic update
      }
      return
    }

    // If this drag moved the folder into a different tier section, persist
    // that reclassification first — comparing against the original
    // server-provided `folders` prop (not `items`, which already reflects
    // the local optimistic change) to know whether a tier change actually
    // happened during this drag.
    if (draggedFolderId) {
      const current = items.find((f) => f.id === draggedFolderId)
      const original = folders.find((f) => f.id === draggedFolderId)
      if (current && original && original.type === "AUTO") {
        const currentSection = sectionOf(current)
        const originalSection = sectionOf(original)
        if (currentSection !== originalSection && currentSection !== "custom") {
          await fetch("/api/folder/set-tier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folderId: draggedFolderId,
              tier: currentSection.toUpperCase(),
            }),
          }).catch(() => {})
        }
      }
    }

    const draggableIds = items
      .filter((f) => !PINNED_FOLDER_NAMES.includes(f.name) && !f.parentId)
      .map((f) => f.id)
    if (draggableIds.length < 2) return

    setSaving(true)
    await fetch("/api/folder/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: draggableIds }),
    }).catch(() => {})
    setSaving(false)
  }

  // The small × on a nested chip — moves a child folder back out to
  // top-level immediately, no drag required. Deliberately a plain click
  // rather than a reverse-drag gesture: dragging a chip back out to a
  // specific section would need its own drop-zone plumbing for a case
  // that's simple enough to just be a button.
  async function unnest(folderId: string) {
    setUnnesting(folderId)
    const res = await fetch("/api/folder/nest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, parentId: null }),
    }).catch(() => null)
    setUnnesting(null)
    if (!res || !res.ok) {
      toast.error("Couldn't move that folder back out — try again.")
      return
    }
    setItems((prev) => prev.map((f) => (f.id === folderId ? { ...f, parentId: null } : f)))
  }

  const filtered = items.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const topLevel = filtered.filter((f) => !f.parentId)
  const pinned = topLevel.filter((f) => PINNED_FOLDER_NAMES.includes(f.name))

  const childrenOf = useMemo(() => {
    const map = new Map<string, Folder[]>()
    for (const f of filtered) {
      if (!f.parentId) continue
      if (!map.has(f.parentId)) map.set(f.parentId, [])
      map.get(f.parentId)!.push(f)
    }
    return map
  }, [filtered])

  const sections = useMemo(() => {
    const grouped: Record<Section, Folder[]> = {
      advanced: [],
      intermediate: [],
      fundamentals: [],
      custom: [],
    }
    for (const f of topLevel) {
      if (PINNED_FOLDER_NAMES.includes(f.name)) continue
      grouped[sectionOf(f)].push(f)
    }
    return grouped
  }, [topLevel])

  if (folders.length === 0) {
    return <p className="text-gray-500">{emptyMessage ?? "No folders yet."}</p>
  }

  function renderTile(folder: Folder) {
    const isNeedsRevision = folder.name === "Needs Revision"
    const isPinned = PINNED_FOLDER_NAMES.includes(folder.name)
    const draggable = dragEnabled && !isPinned
    const children = childrenOf.get(folder.id) ?? []
    const isNestTarget = nestTargetId === folder.id

    return (
      <div
        key={folder.id}
        draggable={draggable}
        onDragStart={() => draggable && setDragId(folder.id)}
        onDragOver={(e) => {
          if (!draggable) return
          e.preventDefault()
          if (!dragId || dragId === folder.id) return
          const dragged = items.find((f) => f.id === dragId)
          if (!dragged) return

          // Middle band of the tile = "drop to nest inside this folder".
          // Top/bottom edges = the existing reorder/retier behavior.
          const rect = e.currentTarget.getBoundingClientRect()
          const relY = (e.clientY - rect.top) / rect.height
          const inCenterBand = relY > 0.3 && relY < 0.7

          const eligibleNestTarget =
            inCenterBand &&
            !folder.parentId && // can't nest inside an already-nested folder
            !dragged.parentId && // only top-level folders can be dragged to nest
            (dragged._count.children ?? 0) === 0 // dragged folder can't already have children

          if (eligibleNestTarget) {
            setNestTargetId(folder.id)
            return
          }
          setNestTargetId(null)
          reorderLocally(folder.id)
        }}
        onDrop={(e) => e.preventDefault()}
        onDragEnd={persistOrder}
        className={`rounded-xl p-5 transition ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${dragId === folder.id ? "opacity-40" : ""} ${
          isNestTarget ? "ring-2 ring-purple-400 bg-purple-950/30" : ""
        } ${
          isNeedsRevision
            ? "bg-orange-950/40 border border-orange-700/60 hover:bg-orange-950/60"
            : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        <Link href={`/folders/${folder.id}`} className="block">
          <div className="text-2xl mb-2">{isNeedsRevision ? "🔥" : "📁"}</div>
          <h3 className="font-semibold text-white">{folder.name}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {folder._count.problems} problems
          </p>
          <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            {folder.type}
          </span>
        </Link>

        {children.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-1.5">
            {children.map((child) => (
              <span
                key={child.id}
                className="inline-flex items-center gap-1 text-xs bg-gray-800 rounded-full pl-2 pr-1 py-0.5"
              >
                <Link href={`/folders/${child.id}`} className="text-gray-300 hover:text-white">
                  📁 {child.name}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    unnest(child.id)
                  }}
                  disabled={unnesting === child.id}
                  title="Move back out to top-level"
                  className="text-gray-500 hover:text-white px-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders..."
          className="flex-1 bg-gray-900 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
        {dragEnabled && (
          <span className="text-xs text-gray-500 hidden sm:inline">
            {saving ? "Saving…" : "Drag to reorder, drop on another section to reclassify, or onto a folder's center to nest"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No folders match &quot;{search}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {pinned.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pinned.map(renderTile)}
            </div>
          )}

          {SECTION_ORDER.map((section) => {
            const sectionFolders = sections[section]
            if (sectionFolders.length === 0) return null
            return (
              <div key={section}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  {SECTION_LABELS[section]}
                  <span className="ml-2 text-gray-600 normal-case font-normal">
                    ({sectionFolders.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {sectionFolders.map(renderTile)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

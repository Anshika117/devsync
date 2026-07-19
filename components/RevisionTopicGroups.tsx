"use client"
import { useState } from "react"
import { toast } from "sonner"
import ProblemList from "@/components/ProblemList"
import { getPrimaryTag } from "@/lib/tagNormalizer"

interface Problem {
  id: string
  title: string
  url: string
  platform: string
  difficulty: string
  tags: string[]
  notes?: string | null
}

interface Props {
  problems: Problem[]
  initialStarred?: string[]
  currentFolderId?: string
  allFolders?: { id: string, name: string }[]
  // Pagination — this view used to receive a single, hard-capped batch (200)
  // with no way to see anything past it. Now wired the same way ProblemList's
  // own "Load more" already works: folderId + cursor drive further fetches
  // against the same /api/folder/[folderId]/problems route, which already
  // works for any folder and needed no changes to support this one too.
  folderId?: string
  initialHasMore?: boolean
  initialNextCursor?: string | null
}

// "Needs Revision" has no real subfolders in the schema — Folder has no
// parentId, and adding one just for this view would mean a migration plus
// changes to every other place that lists folders flatly. Instead this
// groups the same stale problems by getPrimaryTag() (the exact function
// that names the regular AUTO topic folders during sync), entirely at
// render time. Result: it *looks* like Needs Revision contains topic
// subfolders, without the data model actually gaining nesting.
export default function RevisionTopicGroups({
  problems,
  initialStarred = [],
  currentFolderId,
  allFolders = [],
  folderId,
  initialHasMore = false,
  initialNextCursor = null,
}: Props) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [loadedProblems, setLoadedProblems] = useState<Problem[]>(problems)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  // Same "fetch, append, let the next render re-derive everything" shape as
  // ProblemList's own loadMore(). Re-grouping by topic on every extra page is
  // just one more pass over whatever's been loaded so far — cheap enough
  // that there's no need for a fancier incremental-grouping scheme just
  // because the grouping itself happens client-side instead of in the query.
  async function loadMore() {
    if (!folderId || !nextCursor || loadingMore) return
    setLoadingMore(true)
    const res = await fetch(`/api/folder/${folderId}/problems?cursor=${nextCursor}`)
    if (!res.ok) {
      toast.error("Couldn't load more problems — try again.")
      setLoadingMore(false)
      return
    }
    const data = await res.json()
    setLoadedProblems(prev => [...prev, ...data.problems])
    setHasMore(data.nextCursor !== null)
    setNextCursor(data.nextCursor)
    setLoadingMore(false)
  }

  const groups = new Map<string, Problem[]>()
  for (const p of loadedProblems) {
    const topic = getPrimaryTag(p.tags)
    if (!groups.has(topic)) groups.set(topic, [])
    groups.get(topic)!.push(p)
  }
  const sortedTopics = Array.from(groups.keys()).sort(
    (a, b) => groups.get(b)!.length - groups.get(a)!.length
  )

  if (loadedProblems.length === 0) {
    return <p className="text-gray-500">Nothing stale right now — you&apos;re all caught up.</p>
  }

  if (activeTopic) {
    const topicProblems = groups.get(activeTopic) ?? []
    return (
      <div>
        <button
          onClick={() => setActiveTopic(null)}
          className="mb-4 text-sm text-gray-400 hover:text-white cursor-pointer"
        >
          ← Back to topics
        </button>
        <h2 className="text-xl font-bold text-white mb-4">{activeTopic}</h2>
        <ProblemList
          problems={topicProblems}
          initialStarred={initialStarred}
          currentFolderId={currentFolderId}
          allFolders={allFolders}
          revisionDismiss
        />
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sortedTopics.map(topic => {
          const count = groups.get(topic)!.length
          return (
            <button
              key={topic}
              onClick={() => setActiveTopic(topic)}
              className="text-left rounded-xl p-5 bg-gray-900 hover:bg-gray-800 transition cursor-pointer"
            >
              <div className="text-2xl mb-2">📁</div>
              <h3 className="font-semibold text-white">{topic}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {count} problem{count !== 1 ? "s" : ""}
              </p>
            </button>
          )
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition text-sm font-semibold cursor-pointer"
          >
            {loadingMore ? "Loading..." : "Load more problems"}
          </button>
        </div>
      )}
    </div>
  )
}

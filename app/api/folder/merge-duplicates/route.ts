import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// One-time cleanup for folders that became case-variant duplicates before
// tag normalization existed (e.g. "Binary Search" and "binary search" as
// two separate rows, from a LeetCode sync and a Codeforces sync
// respectively — see lib/tagNormalizer.ts and lib/folderUpsert.ts for the
// fix that stops this happening going forward). Groups this user's own
// folders by (lowercased name, type); for any group with more than one
// folder, keeps the oldest one and moves every problem from the others
// into it before deleting the duplicates. Safe to run more than once —
// it's a no-op once there's nothing left to merge.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const folders = await prisma.folder.findMany({ where: { userId } })

  const groups = new Map<string, typeof folders>()
  for (const f of folders) {
    const key = `${f.type}:${f.name.toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  let mergedGroups = 0
  let movedProblems = 0
  let deletedFolders = 0

  for (const group of groups.values()) {
    if (group.length < 2) continue
    mergedGroups++

    const [keeper, ...duplicates] = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )

    for (const dup of duplicates) {
      const links = await prisma.folderProblem.findMany({ where: { folderId: dup.id } })

      for (const link of links) {
        await prisma.folderProblem.upsert({
          where: { folderId_problemId: { folderId: keeper.id, problemId: link.problemId } },
          update: {},
          create: { folderId: keeper.id, problemId: link.problemId },
        })
        movedProblems++
      }

      await prisma.folder.delete({ where: { id: dup.id } })
      deletedFolders++
    }
  }

  return NextResponse.json({ mergedGroups, movedProblems, deletedFolders })
}

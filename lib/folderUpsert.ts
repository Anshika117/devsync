import { prisma } from "@/lib/prisma"
import type { FolderType } from "@prisma/client"

// Case-insensitive find-or-create for a folder. Folder names aren't
// case-normalized at the database level — Postgres text comparison (and
// the @@unique([userId, name, type]) constraint) is case-sensitive by
// default — so without this, "Binary Search" and "binary search" would
// sit as two separate rows even though they're obviously the same folder
// to a person looking at the dashboard. This is defense-in-depth on top of
// lib/tagNormalizer.ts's alias table: normalizeTag() prevents the mismatch
// for known tags, this catches anything that still slips through with
// different casing (an unrecognized tag, or a user typing a CUSTOM folder
// name that happens to differ only by case from an existing one).
export async function findOrCreateFolder(userId: string, name: string, type: FolderType) {
  const existing = await prisma.folder.findFirst({
    where: { userId, type, name: { equals: name, mode: "insensitive" } },
  })
  if (existing) return existing
  return prisma.folder.create({ data: { userId, name, type } })
}

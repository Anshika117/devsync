import { NextResponse } from "next/server"
import { z, type ZodType } from "zod"

// Every mutating route used to hand-roll its own "is this field present and
// the right shape" checks (see git history) — fine individually, but each
// one was a slightly different amount of thorough, and none of them caught
// wrong *types* (a number where a string was expected, an extra field with
// no length cap). One shared parser + one schema per route body replaces
// that ad hoc checking with the same declarative shape every route.
// Returns the same 400 shape those manual checks already returned, so no
// caller (client-side fetch, tests) needed to change.
export function parseBody<T>(schema: ZodType<T>, body: unknown): { data: T } | { error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    return { error: NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid request" }, { status: 400 }) }
  }
  return { data: result.data }
}

const id = z.string().min(1, "id required")
const optionalId = z.string().min(1).nullable().optional()

export const folderCreateSchema = z.object({ name: z.string().trim().min(1, "Name required").max(100) })
export const folderRenameSchema = z.object({ folderId: id, name: z.string().trim().min(1, "Name required").max(100) })
export const folderDeleteSchema = z.object({
  folderId: id,
  action: z.enum(["move_problems", "delete_problems"]).optional(),
  targetFolderId: optionalId,
})
export const folderNestSchema = z.object({ folderId: id, parentId: optionalId })
export const folderReorderSchema = z.object({ folderIds: z.array(id).min(1, "folderIds required") })
export const folderSetTierSchema = z.object({
  folderId: id,
  tier: z.enum(["ADVANCED", "INTERMEDIATE", "FUNDAMENTALS"]),
})

export const goalAddSchema = z.object({ title: z.string().trim().min(1, "Title required").max(200) })
export const goalIdSchema = z.object({ goalId: id })
export const recurringGoalAddSchema = z.object({ title: z.string().trim().min(1, "Title required").max(200) })
export const recurringGoalDeleteSchema = z.object({ recurringGoalId: id })

export const problemIdSchema = z.object({ problemId: id })
export const problemMoveSchema = z.object({ problemId: id, fromFolderId: optionalId, toFolderId: id })
export const problemReviewSchema = z.object({ problemId: id, quality: z.number().min(0).max(5) })
export const problemDismissRevisionSchema = z.object({ problemId: id, folderId: id })
export const problemAddSchema = z.object({
  folderId: id,
  title: z.string().trim().min(1, "Title required"),
  url: z.string().trim().min(1, "URL required"),
  // Same four values as Prisma's Platform/Difficulty enums (schema.prisma) —
  // kept here rather than imported so this schema catches a bad value with a
  // clean 400 before it ever reaches Postgres as an invalid enum write.
  platform: z.enum(["LeetCode", "Codeforces", "CodeChef", "Other"]).default("Other"),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Unknown"]).default("Medium"),
  tags: z.array(z.string()).optional().default([]),
})

export const notesSaveSchema = z.object({ problemId: id, notes: z.string().max(20000).nullable() })
export const revisionToggleSchema = z.object({ problemId: id })

export const profileUpdateSchema = z.object({
  lcUsername: z.string().trim().max(50).nullable().optional(),
  cfHandle: z.string().trim().max(50).nullable().optional(),
  bufferDay: z.number().min(0).max(6).nullable().optional(),
})

export const syncUsernameSchema = z.object({ username: z.string().trim().min(1, "Username required") })

export const hintRagSchema = z.object({
  problemStatement: z.string().trim().min(1, "Problem statement required"),
  problemTitle: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
})

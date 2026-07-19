import { describe, it, expect, vi, beforeEach } from "vitest"

// Regression coverage for the "{ id, userId }" ownership pattern documented
// in DECISIONS.md (see "Why updateMany + userId in the WHERE clause instead
// of update by id alone") — that note explicitly flagged this as untested.
// Every mutating route that touches a resource by id is supposed to scope
// the query by the *caller's* userId too, so one user can never read or
// write another user's folder/problem/goal just by knowing or guessing its
// id (a textbook IDOR bug). These tests don't hit a real database — they
// mock Prisma and assert two things per route: (1) the query Prisma
// actually received was scoped to the signed-in user's id, and (2) when
// that scoped query finds nothing (i.e. the resource belongs to someone
// else), the route responds 404 rather than performing the write anyway.
vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/rateLimit", () => ({ checkCooldown: vi.fn().mockResolvedValue(true) }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    folder: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    problem: { findFirst: vi.fn(), updateMany: vi.fn() },
    dailyGoal: { findFirst: vi.fn(), update: vi.fn() },
    folderProblem: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
  },
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { POST as renameFolder } from "@/app/api/folder/rename/route"
import { POST as setTierFolder } from "@/app/api/folder/set-tier/route"
import { POST as saveNotes } from "@/app/api/notes/save/route"
import { POST as toggleGoal } from "@/app/api/goal/toggle/route"
import { POST as toggleRevision } from "@/app/api/revision/toggle/route"

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>
const ME = "user-1"

function postJson(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: ME } })
})

describe("folder/rename ownership", () => {
  it("scopes the lookup by the caller's userId, not just the folder id", async () => {
    ;(prisma.folder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await renameFolder(postJson({ folderId: "someone-elses-folder", name: "New name" }))
    expect(prisma.folder.findFirst).toHaveBeenCalledWith({ where: { id: "someone-elses-folder", userId: ME } })
  })

  it("404s instead of renaming when the folder isn't this user's", async () => {
    ;(prisma.folder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await renameFolder(postJson({ folderId: "someone-elses-folder", name: "New name" }))
    expect(res.status).toBe(404)
    expect(prisma.folder.update).not.toHaveBeenCalled()
  })
})

describe("folder/set-tier ownership", () => {
  it("scopes the updateMany by userId (and AUTO type) rather than id alone", async () => {
    ;(prisma.folder.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    await setTierFolder(postJson({ folderId: "not-mine", tier: "ADVANCED" }))
    expect(prisma.folder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "not-mine", userId: ME, type: "AUTO" }) })
    )
  })

  it("404s when zero rows matched (folder isn't this user's)", async () => {
    ;(prisma.folder.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const res = await setTierFolder(postJson({ folderId: "not-mine", tier: "ADVANCED" }))
    expect(res.status).toBe(404)
  })
})

describe("notes/save ownership", () => {
  it("uses updateMany with { id, userId } so it can't overwrite another user's notes", async () => {
    ;(prisma.problem.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    await saveNotes(postJson({ problemId: "not-mine", notes: "haha got your notes" }))
    expect(prisma.problem.updateMany).toHaveBeenCalledWith({
      where: { id: "not-mine", userId: ME },
      data: { notes: "haha got your notes" },
    })
  })

  it("404s rather than silently succeeding when the problem isn't this user's", async () => {
    ;(prisma.problem.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const res = await saveNotes(postJson({ problemId: "not-mine", notes: "x" }))
    expect(res.status).toBe(404)
  })
})

describe("goal/toggle ownership", () => {
  it("looks the goal up scoped to the caller before ever updating it", async () => {
    ;(prisma.dailyGoal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await toggleGoal(postJson({ goalId: "not-mine" }))
    expect(prisma.dailyGoal.findFirst).toHaveBeenCalledWith({ where: { id: "not-mine", userId: ME } })
    expect(prisma.dailyGoal.update).not.toHaveBeenCalled()
  })
})

describe("revision/toggle ownership", () => {
  it("won't star/unstar a problem that doesn't belong to the caller", async () => {
    ;(prisma.problem.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await toggleRevision(postJson({ problemId: "not-mine" }))
    expect(prisma.problem.findFirst).toHaveBeenCalledWith({ where: { id: "not-mine", userId: ME } })
    expect(res.status).toBe(404)
    expect(prisma.folderProblem.create).not.toHaveBeenCalled()
  })
})

describe("cross-cutting: every route in this file requires a session first", () => {
  it("returns 401 before touching Prisma at all when there's no session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await renameFolder(postJson({ folderId: "x", name: "y" }))
    expect(res.status).toBe(401)
    expect(prisma.folder.findFirst).not.toHaveBeenCalled()
  })
})

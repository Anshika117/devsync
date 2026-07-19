import { describe, it, expect } from "vitest"
import { paginate } from "@/lib/pagination"

type Row = { id: string }

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }))

describe("paginate", () => {
  it("returns hasMore=false and nextCursor=null for an empty folder", () => {
    const result = paginate(rows(0), 50)
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it("returns hasMore=false when there are fewer rows than a full page", () => {
    const result = paginate(rows(10), 50)
    expect(result.items).toHaveLength(10)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  // This is the edge case that actually matters: the caller always fetches
  // pageSize + 1 rows to detect a next page. If the folder has *exactly*
  // pageSize problems, Prisma returns exactly pageSize rows (there's no
  // pageSize+1th row to fetch), so this must NOT be mistaken for "there's
  // more" - a one-off bug here would show a phantom "Load more" button that
  // returns an empty next page.
  it("returns hasMore=false when the row count is exactly one page", () => {
    const result = paginate(rows(50), 50)
    expect(result.items).toHaveLength(50)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it("returns hasMore=true and trims the extra row when there's a next page", () => {
    const result = paginate(rows(51), 50)
    expect(result.items).toHaveLength(50)
    expect(result.hasMore).toBe(true)
    // nextCursor must be the last row actually returned to the client
    // (id-49), never the extra lookahead row (id-50) - using the wrong one
    // would skip or duplicate a problem on the next "Load more" call.
    expect(result.nextCursor).toBe("id-49")
  })

  it("still works correctly with a much larger overfetch", () => {
    const result = paginate(rows(200), 50)
    expect(result.items).toHaveLength(50)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe("id-49")
  })
})

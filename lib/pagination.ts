// Shared page size for folder problem lists. Both the initial server-side
// fetch (app/folders/[folderId]/page.tsx) and the "Load more" API route
// (app/api/folder/[folderId]/problems/route.ts) import this constant so the
// first page rendered by the server and the pages fetched afterward by the
// client can never drift out of sync with each other.
export const FOLDER_PROBLEMS_PAGE_SIZE = 50

export interface PaginatedResult<T> {
  items: T[]
  hasMore: boolean
  nextCursor: string | null
}

// Both call sites fetch pageSize + 1 rows from Prisma (one extra, to learn
// whether there's a next page without a separate COUNT query), then need to
// trim that extra row back off and derive the cursor for the next request.
// That slicing logic used to be copy-pasted in both places; pulling it into
// one pure function means there's exactly one place this can be wrong, and
// it's directly unit-testable without a database (see lib/__tests__/pagination.test.ts).
export function paginate<T extends { id: string }>(
  rows: T[],
  pageSize: number
): PaginatedResult<T> {
  const hasMore = rows.length > pageSize
  const items = hasMore ? rows.slice(0, pageSize) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : null
  return { items, hasMore, nextCursor }
}

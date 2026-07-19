// Runs `worker` over `items` with at most `limit` running at once, instead of
// either fully sequential (slow — one request/write at a time) or Promise.all
// over everything at once (unbounded — risks rate-limiting an external API,
// or overwhelming a DB connection pool). Originally lived only inside
// sync/leetcode/route.ts (for bounded-concurrency tag fetching); pulled out
// here so sync/codeforces/route.ts can reuse the exact same logic for its own
// bounded-concurrency DB writes instead of hand-rolling a second copy.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runWorker)
  )

  return results
}

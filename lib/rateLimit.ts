import { redis } from "@/lib/redis"

// A simple cooldown gate: the first call for a given (namespace, id) pair
// within ttlSeconds succeeds; every call after that, until the window
// expires, is rejected. Used to stop a single user from re-triggering an
// expensive action (like a full LeetCode/Codeforces sync) back-to-back.
//
// Uses SET ... NX so the check-and-set is one atomic Redis operation — a
// plain GET-then-SET has a race window where two near-simultaneous requests
// could both read "not on cooldown" before either write lands. NX makes
// that impossible: only the first of the two SETs can ever succeed.
export async function checkCooldown(
  namespace: string,
  id: string,
  ttlSeconds: number
): Promise<boolean> {
  const key = `cooldown:${namespace}:${id}`
  const result = await redis.set(key, "1", { ex: ttlSeconds, nx: true })
  return result === "OK"
}

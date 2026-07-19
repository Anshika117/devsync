import { describe, it, expect, vi, beforeEach } from "vitest"

// checkCooldown's only dependency is the Redis client's `.set` call - mock
// it entirely so this test never needs a real Upstash connection (or even
// the @upstash/redis package installed) and can assert exactly what
// arguments checkCooldown sends Redis.
vi.mock("@/lib/redis", () => ({
  redis: { set: vi.fn() },
}))

import { redis } from "@/lib/redis"
import { checkCooldown } from "@/lib/rateLimit"

const mockSet = redis.set as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockSet.mockReset()
})

describe("checkCooldown", () => {
  it("allows the request when Redis's SET NX succeeds (key didn't exist yet)", async () => {
    mockSet.mockResolvedValue("OK")
    const allowed = await checkCooldown("sync:leetcode", "user-1", 300)
    expect(allowed).toBe(true)
  })

  // This is the actual behavior the cooldown exists for: a second sync
  // attempt within the window must be rejected, not silently allowed
  // through.
  it("rejects the request when Redis's SET NX fails (key already on cooldown)", async () => {
    mockSet.mockResolvedValue(null)
    const allowed = await checkCooldown("sync:leetcode", "user-1", 300)
    expect(allowed).toBe(false)
  })

  it("scopes the cooldown key by both namespace and id, so one user's sync cooldown never blocks another user or another action", async () => {
    mockSet.mockResolvedValue("OK")
    await checkCooldown("sync:codeforces", "user-42", 300)
    expect(mockSet).toHaveBeenCalledWith(
      "cooldown:sync:codeforces:user-42",
      "1",
      { ex: 300, nx: true }
    )
  })

  it("passes the caller's TTL straight through as the Redis expiry", async () => {
    mockSet.mockResolvedValue("OK")
    await checkCooldown("hint:ai", "user-7", 86400)
    expect(mockSet).toHaveBeenCalledWith(
      "cooldown:hint:ai:user-7",
      "1",
      { ex: 86400, nx: true }
    )
  })
})

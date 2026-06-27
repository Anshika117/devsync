Why PrismaAdapter?
Connects NextAuth to Postgres so every Google login creates/updates a User row automatically. Without it, sessions exist only in JWT — no user row in DB, no way to associate problems with a user.

Why session callback?
NextAuth v5 default session only includes name, email, image. The callback explicitly attaches user.id so all API routes can identify who is making the request.

Why PrismaPg adapter in lib/prisma.ts?
Prisma 7 moved to a driver adapter model. Plain new PrismaClient() throws PrismaClientInitializationError. PrismaPg is the official PostgreSQL adapter — required for Prisma 7 with Supabase.

Why globalThis singleton?
Next.js hot reloads create new module instances on every save. Without storing the Prisma client on globalThis, each reload opens a new DB connection. Postgres has a connection limit — this prevents exhausting it in development.

Why AUTO vs CUSTOM folder types?
Sync should only touch AUTO folders — user-created CUSTOM folders (like "Google Prep") must never be overwritten by a sync. The type enum enforces this at the data model level, not just in application logic.

Tag source: LeetCode's question GraphQL query returns official topic tags per problem. We fetch tags per titleSlug during sync rather than using AI classification — deterministic, free, and uses the same taxonomy LeetCode users already know.

Primary tag selection for folder assignment uses LeetCode's own skill tier system as priority: Advanced tags (DP, Backtracking, Divide and Conquer) beat Intermediate tags (Sliding Window, Hash Table, Math) which beat Fundamental tags (Array, String, Sorting). This mirrors LeetCode's own categorization so users see folders organized by the same mental model they already know from the platform.

LeetCode sync pipeline: fetch recent submissions → for each problem fetch topic tags via GraphQL → run getPrimaryTag() with tier priority → upsert AUTO folder → upsert Problem → link via FolderProblem join table. Two separate GraphQL calls per problem because recentAcSubmissionList doesn't return tags — this is a known LeetCode API limitation. At 20 problems this is 40 API calls total, acceptable for now. At scale this would need a queue with rate limiting
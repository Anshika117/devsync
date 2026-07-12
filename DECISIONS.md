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

Why Platform/Difficulty as real Prisma enums instead of plain strings?
A free-text `platform: String` field lets application code write any string — a typo like "Leetcode" (wrong case) silently creates a second, inconsistent value that filters/indexes miss. Making them Postgres enums pushes that validation down to the database: an invalid value is now rejected at the INSERT/UPDATE, not discovered later as a data quality bug. Tradeoff: adding a new platform (e.g. "HackerRank") now requires a migration instead of just writing a new string, which is the right tradeoff for a fixed, small set of values.

Why bounded concurrency (8 in flight) instead of sequential or fully parallel for LeetCode tag fetching?
The sync fetches topic tags with one GraphQL call per problem (see pipeline above) — originally awaited one at a time in a for-loop, so 20 problems meant 20 sequential round trips just for tags. Firing all of them at once with Promise.all is the opposite failure mode: LeetCode's API isn't ours to control, and 40+ simultaneous requests risks 429s or an IP flag. A small worker pool (mapWithConcurrency, limit 8) caps how many requests are in flight at once — most of the speedup of full parallelism, without hammering an external API we don't own.

Why does /api/sync/leetcode respond immediately and do the real work in next/server's after()?
Vercel serverless functions have a request time limit; a sync that awaits 20+ GraphQL calls plus DB writes inside the request risks timing out, especially as a user's problem count grows. after() runs a callback after the HTTP response has already been sent, so the client gets an instant "sync started" response while the actual fetching/upserting continues server-side. codeforces/route.ts already used this pattern — leetcode/route.ts didn't, which was an inconsistency as much as a performance problem.

Why updateMany + userId in the WHERE clause instead of update by id alone (notes/save, and the ownership checks in revision/toggle, problem/move)?
prisma.problem.update({ where: { id } }) only accepts a unique key — there's no way to also require userId in that same where clause. That means any authenticated user who knows (or guesses/enumerates) a problemId can modify a row they don't own — a textbook IDOR (Insecure Direct Object Reference) bug. updateMany's WHERE clause has no such restriction, so { id, userId } together scope the write correctly; a 0-row result means "not found or not yours," and both cases should 404 rather than leak which one it was.

Why does folder/delete take an explicit action ("delete_problems" | "move_problems") instead of just deleting?
A folder's problems don't only exist in that folder in general — an AUTO topic folder and a CUSTOM "Revision" folder can both point at the same Problem row via FolderProblem. Silently cascade-deleting every problem in a folder would also delete problems that are still organized elsewhere. The two explicit modes make the choice visible to the user at delete time: move problems to another folder first, or only delete the ones that don't exist anywhere else (computed via a groupBy count on FolderProblem per problemId).

Migration drift recovery (2026-07-12): a migration that converted platform/difficulty from text to enums failed partway (P3018) because its DROP INDEX statement assumed an index name ("Problem_url_key") that didn't exist on the live database. Root cause: the live schema had already diverged from the migration history — a composite unique index (userId, url) existed on the DB without a corresponding migration file, meaning someone previously ran a schema change (most likely `prisma db push`) that updates the database directly without writing a migration. Diagnosed by querying pg_indexes and pg_type directly rather than assuming the migration folder was accurate. Lesson: migration files are only a reliable source of truth if every schema change goes through them — `db push` is fine for prototyping but breaks that guarantee for any environment with real data.

Why JWT sessions instead of database sessions (2026-07-12)?
NextAuth needs to answer "who is this request from" on every page load. With a PrismaAdapter and no explicit `session.strategy`, NextAuth defaults to database sessions: the cookie holds an opaque token, and every request queries the Session table to validate it and look up the user — one DB round-trip before the page's own data queries even start. Switching to `session: { strategy: "jwt" }` moves that check to signature verification instead: the cookie holds a signed token containing the user id directly, verified in-process with no DB call. The adapter is still used for OAuth account linking (Google sign-in still creates/links the User row correctly) — only session *validation* changed. Tradeoff: a database session can be revoked instantly (delete the row, user is logged out everywhere on their next request); a JWT session can't be killed early since there's no row to delete — it stays valid until it expires. Accepted for this app since it's a personal tracker with no payment/account-takeover-sensitive actions where instant revocation matters.

Why replace window.location.reload()/.href with router.refresh()/router.push() (2026-07-12)?
AddProblemModal, ProfileForm, and ProblemList's move-to-folder all forced a full hard browser navigation after a successful action — re-downloading and re-parsing the entire JS bundle and remounting the whole app, instead of Next's client-side router re-fetching just the current route's data and patching the DOM. Purely additive latency with no upside; there was never a reason these needed a hard reload. router.refresh() re-runs the current route's server-side data fetch in place; router.push() is used where the action also navigates to a different route (sync → dashboard).
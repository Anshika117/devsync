-- This migration originally also created the Platform/Difficulty enum types
-- and swapped the unique index on Problem.url for a composite (userId, url)
-- index. Neither is needed anymore:
--   - The enum types already exist (a prior run of this migration created
--     them before failing on the next statement).
--   - The composite unique index "Problem_userId_url_key" already existed on
--     the live database from an earlier untracked change (schema drift).
-- What's left is the actual column conversion.

-- AlterTable
ALTER TABLE "Problem"
  ALTER COLUMN "platform" TYPE "Platform" USING ("platform"::"Platform"),
  ALTER COLUMN "difficulty" TYPE "Difficulty" USING ("difficulty"::"Difficulty"),
  ALTER COLUMN "difficulty" SET DEFAULT 'Unknown';

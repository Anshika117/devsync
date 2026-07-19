-- CreateEnum
-- Guarded rather than a plain CREATE TYPE: this migration was previously
-- hand-edited to *skip* creating these types, because on one specific
-- database (mid-incident, see git history / DECISIONS.md's "Migration drift
-- recovery" entry) they'd already been created by an earlier partial run.
-- That made the file work for that one database's exact state and nothing
-- else — a fresh database (or any other environment) never gets the types
-- created at all, and fails on the ALTER COLUMN below. This version creates
-- them if missing and silently does nothing if they're already there, so
-- the same file is correct on a brand-new database and on the one this was
-- originally patched for.
DO $$ BEGIN
  CREATE TYPE "Platform" AS ENUM ('LeetCode', 'Codeforces', 'CodeChef', 'Other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Difficulty" AS ENUM ('Easy', 'Medium', 'Hard', 'Unknown');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Problem"
  ALTER COLUMN "platform" TYPE "Platform" USING ("platform"::"Platform"),
  ALTER COLUMN "difficulty" TYPE "Difficulty" USING ("difficulty"::"Difficulty"),
  ALTER COLUMN "difficulty" SET DEFAULT 'Unknown';

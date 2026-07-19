-- AlterTable
-- lcUsername, cfHandle, and emailVerified already exist in schema.prisma and
-- have been in use for a while, but no prior migration file ever actually
-- created them on the User table — they were added directly to a live
-- database at some point (most likely via `prisma db push`), which updates
-- the database without writing a migration. That's invisible as long as
-- you keep reusing that same already-patched database, but a full
-- `migrate reset` rebuilds strictly from migration files, so it produces a
-- User table missing exactly what was never captured in one. This migration
-- closes that gap for good, the same way the 2026-07-12 entry closed a
-- similar gap for the Platform/Difficulty enum columns.
ALTER TABLE "User"
  ADD COLUMN "emailVerified" TIMESTAMP(3),
  ADD COLUMN "lcUsername" TEXT,
  ADD COLUMN "cfHandle" TEXT;

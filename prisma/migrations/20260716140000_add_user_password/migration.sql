-- AlterTable
-- Adds an optional password hash column so accounts can authenticate with
-- email/password (via the new Credentials provider in auth.ts) alongside
-- existing Google-only accounts, which will simply have password = NULL.
ALTER TABLE "User" ADD COLUMN "password" TEXT;
